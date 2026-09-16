import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DemarrageAuth from './DemarrageAuth'
import { oublierInstanceMsal } from './msal'

const instanceSimulee = {
  initialize: vi.fn().mockResolvedValue(undefined),
  handleRedirectPromise: vi.fn().mockResolvedValue(null),
  getAllAccounts: vi.fn().mockReturnValue([]),
  getActiveAccount: vi.fn().mockReturnValue(null),
  setActiveAccount: vi.fn(),
}

vi.mock('@azure/msal-browser', () => ({
  // Fonction classique (et non flèche) pour pouvoir être appelée avec `new`.
  PublicClientApplication: vi.fn(function () {
    return instanceSimulee
  }),
  InteractionRequiredAuthError: class extends Error {},
}))

vi.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

beforeEach(() => {
  oublierInstanceMsal()
  vi.clearAllMocks()
  instanceSimulee.initialize.mockResolvedValue(undefined)
  instanceSimulee.handleRedirectPromise.mockResolvedValue(null)
  instanceSimulee.getAllAccounts.mockReturnValue([])
  instanceSimulee.getActiveAccount.mockReturnValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('démarrage de l’authentification', () => {
  it('affiche un message actionnable quand le client ID est absent', async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', '')

    render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )

    const message = await screen.findByText(/VITE_MSAL_CLIENT_ID/)
    expect(message).toHaveTextContent('.env.local')
    expect(screen.getByRole('heading')).toHaveTextContent('Incomplete configuration')
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
  })

  it('affiche l’application une fois MSAL initialisé', async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'client-id-de-test')

    render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )

    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('n’affiche pas l’application tant que le retour de redirection n’est pas terminé', async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'client-id-de-test')
    let terminerRedirection = () => {}
    instanceSimulee.handleRedirectPromise.mockReturnValue(
      new Promise((resoudre) => {
        terminerRedirection = () => resoudre(null)
      }),
    )

    render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )

    expect(await screen.findByText('Starting…')).toBeInTheDocument()
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
    terminerRedirection()

    expect(await screen.findByText('Application')).toBeInTheDocument()
  })

  it('ne crée qu’une seule instance MSAL même après plusieurs montages', async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'client-id-de-test')

    const premier = render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )
    await screen.findByText('Application')
    premier.unmount()
    render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )

    await screen.findByText('Application')
    expect(instanceSimulee.initialize).toHaveBeenCalledTimes(1)
  })

  it('propose de réessayer quand l’initialisation MSAL échoue', async () => {
    vi.stubEnv('VITE_MSAL_CLIENT_ID', 'client-id-de-test')
    instanceSimulee.handleRedirectPromise.mockRejectedValue(new Error('redirection invalide'))

    render(
      <DemarrageAuth>
        <p>Application</p>
      </DemarrageAuth>,
    )

    expect(await screen.findByText('redirection invalide')).toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('Startup failed')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('Application')).not.toBeInTheDocument()
  })
})
