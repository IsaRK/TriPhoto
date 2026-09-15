import { afterEach, describe, expect, it, vi } from 'vitest'
import { listerDossiersRacine, listerSousDossiers } from './dossiers'

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lecture des dossiers OneDrive', () => {
  it('interroge la racine du drive avec les champs utiles', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse({ value: [] }))
    vi.stubGlobal('fetch', fetchSimule)

    await listerDossiersRacine('jeton-de-test')

    const [url, options] = fetchSimule.mock.calls[0]
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/drive/root/children')
    expect(url).toContain('$select=id,name,folder')
    expect(options.headers.Authorization).toContain('jeton-de-test')
  })

  it('interroge les enfants d’un dossier donné', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse({ value: [] }))
    vi.stubGlobal('fetch', fetchSimule)

    await listerSousDossiers('jeton-de-test', '01ABC/DEF')

    const [url] = fetchSimule.mock.calls[0]
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/drive/items/01ABC%2FDEF/children')
  })

  it('ne garde que les dossiers et ignore les fichiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reponse({
          value: [
            dossier('1', 'Photos'),
            { id: '2', name: 'chat.jpg', file: { mimeType: 'image/jpeg' } },
          ],
        }),
      ),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([{ id: '1', nom: 'Photos', nombreEnfants: 3 }])
  })

  it('suit la pagination jusqu’à la dernière page', async () => {
    const fetchSimule = vi
      .fn()
      .mockResolvedValueOnce(
        reponse({
          value: [dossier('1', 'Photos')],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page-2',
        }),
      )
      .mockResolvedValueOnce(reponse({ value: [dossier('2', 'Vidéos')] }))
    vi.stubGlobal('fetch', fetchSimule)

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(fetchSimule.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/page-2')
    expect(dossiers.map((d) => d.nom)).toEqual(['Photos', 'Vidéos'])
  })

  it('trie les dossiers par ordre alphabétique', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reponse({
          value: [dossier('1', 'Vacances'), dossier('2', 'Été'), dossier('3', 'Archives')],
        }),
      ),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers.map((d) => d.nom)).toEqual(['Archives', 'Été', 'Vacances'])
  })

  it('classe les noms datés dans l’ordre des nombres', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reponse({
          value: [dossier('1', '2024-10'), dossier('2', '2024-2'), dossier('3', '2024-1')],
        }),
      ),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers.map((d) => d.nom)).toEqual(['2024-1', '2024-2', '2024-10'])
  })

  it('compte zéro élément quand Graph ne renvoie pas childCount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reponse({ value: [{ id: '1', name: 'Photos', folder: {} }] })),
    )

    const dossiers = await listerDossiersRacine('jeton-de-test')

    expect(dossiers).toEqual([{ id: '1', nom: 'Photos', nombreEnfants: 0 }])
  })

  it('échoue avec le code HTTP quand Graph refuse la requête', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, { ok: false, status: 404 })))

    await expect(listerSousDossiers('jeton-de-test', 'inconnu')).rejects.toThrowError(/code 404/)
  })

  it('laisse remonter une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await expect(listerDossiersRacine('jeton-de-test')).rejects.toThrowError('Failed to fetch')
  })
})
