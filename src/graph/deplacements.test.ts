import { afterEach, describe, expect, it, vi } from 'vitest'
import { deplacerElement } from './deplacements'

function reponse(options: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => ({}),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('déplacement d’un média', () => {
  it('envoie un PATCH sur l’élément avec le dossier d’arrivée', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse())
    vi.stubGlobal('fetch', fetchSimule)

    await deplacerElement('jeton-de-test', 'mon-drive', 'photo-1', {
      driveId: 'mon-drive',
      id: 'corbeille',
    })

    const [url, options] = fetchSimule.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.microsoft.com/v1.0/drives/mon-drive/items/photo-1')
    expect(options.method).toBe('PATCH')
    expect(options.headers).toEqual({
      Authorization: 'Bearer jeton-de-test',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(options.body as string)).toEqual({ parentReference: { id: 'corbeille' } })
  })

  it('encode les identifiants dans l’URL', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse())
    vi.stubGlobal('fetch', fetchSimule)

    await deplacerElement('jeton-de-test', 'drive/étrange', 'id avec espace', {
      driveId: 'drive/étrange',
      id: 'corbeille',
    })

    expect(fetchSimule.mock.calls[0][0]).toBe(
      'https://graph.microsoft.com/v1.0/drives/drive%2F%C3%A9trange/items/id%20avec%20espace',
    )
  })

  // `PATCH parentReference` ne traverse pas les drives : autant le dire tout de
  // suite plutôt que de laisser remonter une erreur Graph incompréhensible.
  it('refuse un dossier d’arrivée situé sur un autre drive, sans appeler Graph', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse())
    vi.stubGlobal('fetch', fetchSimule)

    await expect(
      deplacerElement('jeton-de-test', 'mon-drive', 'photo-1', {
        driveId: 'drive-partage',
        id: 'corbeille',
      }),
    ).rejects.toThrowError(/autre OneDrive/)
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it('échoue avec le code HTTP quand Graph refuse le déplacement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({ ok: false, status: 403 })))

    await expect(
      deplacerElement('jeton-de-test', 'mon-drive', 'photo-1', {
        driveId: 'mon-drive',
        id: 'corbeille',
      }),
    ).rejects.toThrowError(/code 403/)
  })

  it('laisse remonter une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await expect(
      deplacerElement('jeton-de-test', 'mon-drive', 'photo-1', {
        driveId: 'mon-drive',
        id: 'corbeille',
      }),
    ).rejects.toThrowError('Failed to fetch')
  })
})
