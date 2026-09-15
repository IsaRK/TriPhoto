import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompteMicrosoft from './CompteMicrosoft'

const instanceSimulee = {
  loginRedirect: vi.fn().mockResolvedValue(undefined),
  logoutRedirect: vi.fn().mockResolvedValue(undefined),
  acquireTokenSilent: vi.fn(),
}

const comptes: { homeAccountId: string; username: string }[] = []

const etatMsal = { inProgress: 'none' }

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: instanceSimulee,
    accounts: comptes,
    inProgress: etatMsal.inProgress,
  }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function connecterUnCompte() {
  comptes.push({ homeAccountId: 'compte-1', username: 'alice@outlook.com' })
}

function reponseGraph(donnees: unknown, options: { ok?: boolean; status?: number } = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => donnees,
  } as Response
}

beforeEach(() => {
  comptes.length = 0
  etatMsal.inProgress = 'none'
  instanceSimulee.acquireTokenSilent.mockResolvedValue({ accessToken: 'jeton-de-test' })
  instanceSimulee.loginRedirect.mockResolvedValue(undefined)
  instanceSimulee.logoutRedirect.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('bloc compte Microsoft', () => {
  it('propose la connexion quand aucun compte n’est connecté', async () => {
    render(<CompteMicrosoft />)

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter avec Microsoft' }))

    expect(instanceSimulee.loginRedirect).toHaveBeenCalledWith({
      scopes: ['User.Read', 'Files.ReadWrite'],
    })
  })

  it('n’affiche pas le bouton de connexion pendant la relecture du cache MSAL', () => {
    etatMsal.inProgress = 'startup'
    connecterUnCompte()

    render(<CompteMicrosoft />)

    expect(
      screen.queryByRole('button', { name: 'Se connecter avec Microsoft' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Connexion en cours…')).toBeInTheDocument()
  })

  it('affiche le nom renvoyé par Graph quand un compte est connecté', async () => {
    connecterUnCompte()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponseGraph({ displayName: 'Alice Martin' })))

    render(<CompteMicrosoft />)

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Se connecter avec Microsoft' }),
    ).not.toBeInTheDocument()
  })

  it('déconnecte le compte à la demande', async () => {
    connecterUnCompte()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponseGraph({ displayName: 'Alice Martin' })))

    render(<CompteMicrosoft />)
    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    expect(instanceSimulee.logoutRedirect).toHaveBeenCalled()
  })

  it('affiche une erreur lisible quand Graph refuse la requête', async () => {
    connecterUnCompte()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponseGraph({}, { ok: false, status: 403 })))

    render(<CompteMicrosoft />)

    expect(await screen.findByText(/code 403/)).toBeInTheDocument()
  })

  it('réessaie l’appel Graph à la demande', async () => {
    connecterUnCompte()
    const fetchSimule = vi
      .fn()
      .mockResolvedValueOnce(reponseGraph({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(reponseGraph({ displayName: 'Alice Martin' }))
    vi.stubGlobal('fetch', fetchSimule)

    render(<CompteMicrosoft />)
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(fetchSimule).toHaveBeenCalledTimes(2)
  })

  it('affiche une erreur quand le jeton ne peut pas être obtenu', async () => {
    connecterUnCompte()
    instanceSimulee.acquireTokenSilent.mockRejectedValue(new Error('jeton indisponible'))
    vi.stubGlobal('fetch', vi.fn())

    render(<CompteMicrosoft />)

    expect(await screen.findByText(/jeton indisponible/)).toBeInTheDocument()
  })

  it('propose de se reconnecter sans rediriger quand la session a expiré', async () => {
    connecterUnCompte()
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'Consentement à redonner'),
    )
    vi.stubGlobal('fetch', vi.fn())

    render(<CompteMicrosoft />)
    const bouton = await screen.findByRole('button', { name: 'Se reconnecter' })

    expect(screen.getByText('Votre session Microsoft a expiré.')).toBeInTheDocument()
    expect(instanceSimulee.loginRedirect).not.toHaveBeenCalled()
    await userEvent.click(bouton)
    expect(instanceSimulee.loginRedirect).toHaveBeenCalledTimes(1)
  })

  it('affiche une erreur quand la redirection de connexion est refusée', async () => {
    instanceSimulee.loginRedirect.mockRejectedValue(new Error('interaction_in_progress'))

    render(<CompteMicrosoft />)
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter avec Microsoft' }))

    expect(await screen.findByText(/interaction_in_progress/)).toBeInTheDocument()
  })
})
