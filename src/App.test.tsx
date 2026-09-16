import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// L'écran d'accueil lit le compte MSAL : on simule un utilisateur non connecté
// pour que ces tests ne portent que sur le routage. Les objets sont créés une
// seule fois, comme le fait MsalProvider.
const instanceSimulee = { loginRedirect: vi.fn(), logoutRedirect: vi.fn() }
const aucunCompte: unknown[] = []

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: instanceSimulee, accounts: aucunCompte, inProgress: 'none' }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function afficher(routeInitiale: string) {
  return render(
    <MemoryRouter initialEntries={[routeInitiale]}>
      <App />
    </MemoryRouter>,
  )
}

function titre() {
  return screen.getByRole('heading', { level: 1 }).textContent
}

describe('routage de l’application', () => {
  it('affiche l’écran de configuration sur /', () => {
    afficher('/')

    expect(titre()).toBe('TriPhoto')
  })

  it('affiche l’écran de tri sur /tri', () => {
    afficher('/tri')

    expect(titre()).toBe('Cannot sort')
  })

  it('redirige une route inconnue vers l’écran de configuration', () => {
    afficher('/route-qui-nexiste-pas')

    expect(titre()).toBe('TriPhoto')
  })

  it('navigue du tri vers la configuration', async () => {
    afficher('/tri')

    await userEvent.click(screen.getByRole('link', { name: 'Go to settings' }))

    expect(titre()).toBe('TriPhoto')
  })
})
