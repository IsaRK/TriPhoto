import { afterEach, describe, expect, it, vi } from 'vitest'
import { listerMedias } from './medias'

function reponse(donnees: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => donnees,
  } as Response
}

function photo(id: string, priseLe?: string, options: { miniature?: string } = {}) {
  return {
    id,
    name: `${id}.jpg`,
    size: 1000,
    createdDateTime: '2024-06-01T10:00:00Z',
    file: { mimeType: 'image/jpeg' },
    photo: priseLe ? { takenDateTime: priseLe } : undefined,
    '@microsoft.graph.downloadUrl': `https://telechargement/${id}`,
    thumbnails: options.miniature ? [{ large: { url: options.miniature } }] : undefined,
  }
}

function video(id: string, dates: { surAppareil?: string; envoiOneDrive: string }) {
  return {
    id,
    name: `${id}.mp4`,
    size: 5000,
    createdDateTime: dates.envoiOneDrive,
    fileSystemInfo: dates.surAppareil ? { createdDateTime: dates.surAppareil } : undefined,
    file: { mimeType: 'video/mp4' },
    '@microsoft.graph.downloadUrl': `https://telechargement/${id}`,
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

function simulerEchecReseau() {
  const fetchSimule = vi.fn().mockRejectedValue(new Error('réseau coupé'))
  vi.stubGlobal('fetch', fetchSimule)
  return fetchSimule
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lecture des médias d’un dossier', () => {
  it('interroge le dossier dans son drive avec les champs utiles', async () => {
    const fetchSimule = simulerAppels(reponse({ value: [] }))

    await listerMedias('jeton-de-test', 'drive-partage', 'dossier-1')

    const [url, options] = fetchSimule.mock.calls[0]
    expect(url).toContain(
      'https://graph.microsoft.com/v1.0/drives/drive-partage/items/dossier-1/children',
    )
    expect(url).toContain(
      '$select=id,name,file,photo,video,size,createdDateTime,fileSystemInfo,@microsoft.graph.downloadUrl',
    )
    expect(url).toContain('$expand=thumbnails($select=c1600x1600,large)')
    expect(options.headers.Authorization).toContain('jeton-de-test')
  })

  it('écarte les dossiers et les fichiers qui ne sont ni image ni vidéo', async () => {
    simulerAppels(
      reponse({
        value: [
          photo('a', '2024-01-02T08:00:00Z', { miniature: 'https://miniature/a' }),
          { id: 'c', name: 'Album', folder: { childCount: 2 } },
          {
            id: 'd',
            name: 'notes.pdf',
            file: { mimeType: 'application/pdf' },
            '@microsoft.graph.downloadUrl': 'https://telechargement/d',
          },
        ],
      }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias).toEqual([
      {
        id: 'a',
        driveId: 'mon-drive',
        nom: 'a.jpg',
        type: 'image',
        priseLe: '2024-01-02T08:00:00Z',
        instantPriseLe: Date.parse('2024-01-02T08:00:00Z'),
        urlTelechargement: 'https://telechargement/a',
        urlMiniature: 'https://miniature/a',
        taille: 1000,
      },
    ])
  })

  it('rend le drive demandé et la taille de chaque média', async () => {
    simulerAppels(reponse({ value: [video('film', { envoiOneDrive: '2024-02-02T00:00:00Z' })] }))

    const medias = await listerMedias('jeton', 'drive-de-paul', 'dossier-partage')

    expect(medias[0].driveId).toBe('drive-de-paul')
    expect(medias[0].nom).toBe('film.mp4')
    expect(medias[0].taille).toBe(5000)
    expect(medias[0].type).toBe('video')
  })

  it('conserve un média dont Graph n’a pas renvoyé l’URL de téléchargement', async () => {
    simulerAppels(
      reponse({
        value: [{ id: 'a', name: 'a.jpg', file: { mimeType: 'image/jpeg' } }],
      }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias.map((media) => media.id)).toEqual(['a'])
    expect(medias[0].urlTelechargement).toBeNull()
  })

  it('suit la pagination jusqu’à la dernière page', async () => {
    const fetchSimule = simulerAppels(
      reponse({
        value: [photo('a', '2024-03-01T00:00:00Z')],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page-2',
      }),
      reponse({ value: [photo('b', '2024-04-01T00:00:00Z')] }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(fetchSimule).toHaveBeenCalledTimes(2)
    expect(fetchSimule.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/page-2')
    expect(medias.map((media) => media.id)).toEqual(['a', 'b'])
  })

  it('trie par date de prise de vue croissante, la plus ancienne d’abord', async () => {
    simulerAppels(
      reponse({
        value: [
          photo('recente', '2024-05-10T08:00:00Z'),
          photo('ancienne', '2019-02-03T08:00:00Z'),
          photo('intermediaire', '2021-12-25T08:00:00Z'),
        ],
      }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias.map((media) => media.id)).toEqual(['ancienne', 'intermediaire', 'recente'])
  })

  it('préfère la date de l’appareil d’origine à la date d’envoi dans OneDrive', async () => {
    simulerAppels(
      reponse({
        value: [
          photo('photo-2020', '2020-07-14T12:00:00Z'),
          video('film-2019', {
            surAppareil: '2019-08-01T12:00:00Z',
            envoiOneDrive: '2024-06-01T10:00:00Z',
          }),
        ],
      }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias.map((media) => media.id)).toEqual(['film-2019', 'photo-2020'])
    expect(medias[0].priseLe).toBe('2019-08-01T12:00:00Z')
  })

  it('garde les dates valides ordonnées malgré un média à la date illisible', async () => {
    simulerAppels(
      reponse({
        value: [
          photo('recente', '2021-01-01T00:00:00Z'),
          photo('illisible', '0000:00:00 00:00:00'),
          photo('ancienne', '2019-01-01T00:00:00Z'),
          photo('intermediaire', '2020-01-01T00:00:00Z'),
        ],
      }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias.map((media) => media.id)).toEqual([
      'illisible',
      'ancienne',
      'intermediaire',
      'recente',
    ])
    expect(medias[0].instantPriseLe).toBe(0)
  })

  it('renvoie la miniature large quand Graph en a produit une', async () => {
    simulerAppels(
      reponse({ value: [photo('a', undefined, { miniature: 'https://miniature/a' }), photo('b')] }),
    )

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias[0].urlMiniature).toBe('https://miniature/a')
    expect(medias[1].urlMiniature).toBeNull()
  })

  it('préfère la miniature sur mesure à la taille large', async () => {
    const element = {
      ...photo('a'),
      thumbnails: [
        {
          c1600x1600: { url: 'https://miniature/sur-mesure' },
          large: { url: 'https://miniature/large' },
        },
      ],
    }
    simulerAppels(reponse({ value: [element] }))

    const medias = await listerMedias('jeton', 'mon-drive', 'dossier-1')

    expect(medias[0].urlMiniature).toBe('https://miniature/sur-mesure')
  })

  it('signale clairement un refus de Microsoft Graph', async () => {
    simulerAppels(reponse({}, { ok: false, status: 403 }))

    await expect(listerMedias('jeton', 'mon-drive', 'dossier-1')).rejects.toThrow(
      'Microsoft Graph refused to read the media (code 403).',
    )
  })

  it('signale un refus survenu sur une page suivante', async () => {
    simulerAppels(
      reponse({
        value: [photo('a', '2024-03-01T00:00:00Z')],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page-2',
      }),
      reponse({}, { ok: false, status: 503 }),
    )

    await expect(listerMedias('jeton', 'mon-drive', 'dossier-1')).rejects.toThrow(
      'Microsoft Graph refused to read the media (code 503).',
    )
  })

  it('laisse remonter une erreur réseau', async () => {
    simulerEchecReseau()

    await expect(listerMedias('jeton', 'mon-drive', 'dossier-1')).rejects.toThrow('réseau coupé')
  })
})
