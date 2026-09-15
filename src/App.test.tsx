import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

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

    expect(titre()).toBe('Tri')
  })

  it('redirige une route inconnue vers l’écran de configuration', () => {
    afficher('/route-qui-nexiste-pas')

    expect(titre()).toBe('TriPhoto')
  })

  it('navigue de la configuration vers le tri', async () => {
    afficher('/')

    await userEvent.click(screen.getByRole('link', { name: 'Commencer le tri' }))

    expect(titre()).toBe('Tri')
  })

  it('navigue du tri vers la configuration', async () => {
    afficher('/tri')

    await userEvent.click(screen.getByRole('link', { name: 'Retour à la configuration' }))

    expect(titre()).toBe('TriPhoto')
  })
})
