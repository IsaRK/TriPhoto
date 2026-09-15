import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DIRECTIONS } from '../tri/directions'
import Logo from './Logo'

describe('logo', () => {
  it('porte le nom du produit comme texte accessible', () => {
    render(<Logo />)

    expect(screen.getByRole('img', { name: 'TriPhoto' })).toBeInTheDocument()
  })

  it('affiche le mot TriPhoto', () => {
    const { container } = render(<Logo />)

    expect(container.textContent).toBe('TriPhoto')
  })

  it('dessine une flèche par direction de swipe', () => {
    const { container } = render(<Logo />)

    expect(container.querySelectorAll('path')).toHaveLength(DIRECTIONS.length)
  })

  it('reprend exactement les couleurs des quatre directions', () => {
    const { container } = render(<Logo />)

    const couleurs = [...container.querySelectorAll('path')].map((fleche) =>
      fleche.getAttribute('fill'),
    )

    expect(couleurs).toEqual(DIRECTIONS.map((info) => info.couleur))
  })
})
