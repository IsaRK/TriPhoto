import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listerDossiersRacine, listerSousDossiers, oublierIdDeMonDrive } from './dossiers'

function reponse(donnees: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => donnees,
  } as Response
}

function dossier(id: string, nom: string, childCount = 3) {
  return { id, name: nom, folder: { childCount } }
}

function raccourci(nom: string, driveId: string, id: string, childCount = 3) {
  return {
    id: 'raccourci-local',
    name: nom,
    remoteItem: { id, folder: { childCount }, parentReference: { driveId } },
  }
}

function simulerAppels(...reponses: Response[]) {
  const fetchSimule = vi.fn()
  for (const uneReponse of reponses) {
    fetchSimule.mockResolvedValueOnce(uneReponse)
  }
  vi.stubGlobal('fetch', fetchSimule)
  return fetchSimule
}

function monDrive() {
  return reponse({ id: 'mon-drive' })
}

beforeEach(() => {
  oublierIdDeMonDrive()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lecture des dossiers OneDrive', () => {
  it('interroge la racine du drive avec les champs utiles', async () => {
    const fetchSimule = simulerAppels(monDrive(), reponse({ value: [] }))

    await listerDossiersRacine('jeton-de-test')

    const [urlDrive] = fetchSimule.mock.calls[0]
    const [url, options] = fetchSimule.mock.calls[1]
    expect(urlDrive).toBe('https://graph.microsoft.com/v1.0/me/drive?$select=id')
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/drive/root/children')
    expect(url).toContain('$select=id,name,folder,remoteItem')
    expect(options.headers.Authorization).toContain('jeton-de-test')
  })

  it('interroge les enfants d’un dossier donné dans son drive', async () => {
    const fetchSimule = simulerAppels(monDrive(), reponse({ value: [] }))

    await listerSousDossiers('jeton-de-test', 'drive-a-moi', '01ABC/DEF')

    const [url] = fetchSimule.mock.calls[1]
    expect(url).toContain(
      'https://graph.microsoft.com/v1.0/drives/drive-a-moi/items/01ABC%2FDEF/children',
    )
  })

  it('marque comme partagé tout dossier vivant dans un autre drive', async () => {
    simulerAppels(monDrive(), reponse({ value: [dossier('9', 'Juillet')] }))

    const dossiers = await listerSousDossiers('jeton-de-test', 'drive-de-paul', 'dossier-distant')

    expect(dossiers).toEqual([
      { id: '9', driveId: 'drive-de-paul', nom: 'Juillet', nombreEnfants: 3, partage: true },
    ])
  })

  it('ne redemande pas l’identifiant de notre drive à chaque listage', async () => {
    const fetchSimule = simulerAppels(
      monDrive(),
      reponse({ value: [] }),
      reponse({ value: [] }),
      reponse({ value: [] }),
    )

    await listerDossiersRacine('jeton-de-test')
    await listerDossiersRacine('jeton-de-test')

    const urls = fetchSimule.mock.calls.map(([url]) => url as string)
    expect(urls.filter((url) => url.includes('/me/drive?'))).toHaveLength(1)
  })

  it('préfère le dossier distant quand l’élément porte les deux facettes', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [
          {
            id: 'raccourci-local',
            name: 'Album famille',
            folder: { childCount: 0 },
            remoteItem: {
              id: 'dossier-distant',
              folder: { childCount: 12 },
              parentReference: { driveId: 'drive-de-paul' },
            },
          },
        ],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([
      {
        id: 'dossier-distant',
        driveId: 'drive-de-paul',
        nom: 'Album famille',
        nombreEnfants: 12,
        partage: true,
      },
    ])
  })

  it('ne garde que les dossiers et ignore les fichiers', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [
          dossier('1', 'Photos'),
          { id: '2', name: 'chat.jpg', file: { mimeType: 'image/jpeg' } },
        ],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([
      { id: '1', driveId: 'mon-drive', nom: 'Photos', nombreEnfants: 3, partage: false },
    ])
  })

  it('suit un raccourci vers un dossier partagé jusqu’au drive d’origine', async () => {
    simulerAppels(
      monDrive(),
      reponse({ value: [raccourci('Album famille', 'drive-de-paul', 'dossier-distant', 12)] }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([
      {
        id: 'dossier-distant',
        driveId: 'drive-de-paul',
        nom: 'Album famille',
        nombreEnfants: 12,
        partage: true,
      },
    ])
  })

  it('ignore un raccourci vers un fichier partagé', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [
          {
            id: 'raccourci-local',
            name: 'facture.pdf',
            remoteItem: {
              id: 'fichier-distant',
              file: { mimeType: 'application/pdf' },
              parentReference: { driveId: 'drive-de-paul' },
            },
          },
        ],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([])
  })

  it('ignore un raccourci dont Graph ne donne pas le drive d’origine', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [{ id: 'raccourci-local', name: 'Album', remoteItem: { id: 'x', folder: {} } }],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([])
  })

  it('suit la pagination jusqu’à la dernière page', async () => {
    const fetchSimule = simulerAppels(
      monDrive(),
      reponse({
        value: [dossier('1', 'Photos')],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page-2',
      }),
      reponse({ value: [dossier('2', 'Vidéos')] }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(fetchSimule.mock.calls[2][0]).toBe('https://graph.microsoft.com/v1.0/page-2')
    expect(dossiers.map((d) => d.nom)).toEqual(['Photos', 'Vidéos'])
  })

  it('trie les dossiers par ordre alphabétique', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [dossier('1', 'Vacances'), dossier('2', 'Été'), dossier('3', 'Archives')],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers.map((d) => d.nom)).toEqual(['Archives', 'Été', 'Vacances'])
  })

  it('classe les noms datés dans l’ordre des nombres', async () => {
    simulerAppels(
      monDrive(),
      reponse({
        value: [dossier('1', '2024-10'), dossier('2', '2024-2'), dossier('3', '2024-1')],
      }),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers.map((d) => d.nom)).toEqual(['2024-1', '2024-2', '2024-10'])
  })

  it('compte zéro élément quand Graph ne renvoie pas childCount', async () => {
    simulerAppels(monDrive(), reponse({ value: [{ id: '1', name: 'Photos', folder: {} }] }))

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([
      { id: '1', driveId: 'mon-drive', nom: 'Photos', nombreEnfants: 0, partage: false },
    ])
  })

  it('échoue avec le code HTTP quand Graph refuse la requête', async () => {
    simulerAppels(monDrive(), reponse({}, { ok: false, status: 404 }))

    await expect(listerSousDossiers('jeton-de-test', 'mon-drive', 'inconnu')).rejects.toThrowError(
      /code 404/,
    )
  })

  it('échoue clairement quand Graph refuse de donner notre drive', async () => {
    simulerAppels(reponse({}, { ok: false, status: 403 }))

    await expect(listerDossiersRacine('jeton-de-test')).rejects.toThrowError(/code 403/)
  })

  it('laisse remonter une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await expect(listerDossiersRacine('jeton-de-test')).rejects.toThrowError('Failed to fetch')
  })
})
