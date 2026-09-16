import { afterEach, describe, expect, it, vi } from 'vitest'
import { recupererProfil } from './profil'

function reponse(donnees: unknown, options: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => donnees,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('appel Graph /me', () => {
  it('appelle la bonne URL avec le jeton en en-tête', async () => {
    const fetchSimule = vi.fn().mockResolvedValue(reponse({ displayName: 'Alice Martin' }))
    vi.stubGlobal('fetch', fetchSimule)

    await recupererProfil('jeton-de-test')

    const [url, options] = fetchSimule.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,mail,userPrincipalName',
    )
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-de-test' })
  })

  it('retourne le nom et l’adresse du compte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reponse({ displayName: 'Alice Martin', mail: 'alice@outlook.com' })),
    )

    const profil = await recupererProfil('jeton-de-test')

    expect(profil).toEqual({ nom: 'Alice Martin', email: 'alice@outlook.com' })
  })

  // Cas très courant des comptes Microsoft personnels : Graph laisse `mail` vide
  // et ne renseigne que `userPrincipalName`. Sans ce repli, aucune adresse ne
  // s'afficherait sur l'écran d'accueil.
  it('prend userPrincipalName quand mail est vide', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          reponse({ displayName: 'Alice', mail: null, userPrincipalName: 'alice@live.fr' }),
        ),
    )

    const profil = await recupererProfil('jeton-de-test')

    expect(profil.email).toBe('alice@live.fr')
  })

  it('se rabat sur givenName quand displayName est absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(reponse({ givenName: 'Alice', userPrincipalName: 'alice@live.fr' })),
    )

    const profil = await recupererProfil('jeton-de-test')

    expect(profil).toEqual({ nom: 'Alice', email: 'alice@live.fr' })
  })

  it('se rabat sur un libellé générique quand Graph ne renvoie aucun nom', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({})))

    const profil = await recupererProfil('jeton-de-test')

    expect(profil).toEqual({ nom: 'Compte Microsoft', email: null })
  })

  it('échoue avec le code HTTP quand Graph refuse la requête', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, { ok: false, status: 401 })))

    await expect(recupererProfil('jeton-perime')).rejects.toThrowError(/code 401/)
  })

  it('laisse remonter une erreur réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await expect(recupererProfil('jeton-de-test')).rejects.toThrowError('Failed to fetch')
  })
})
