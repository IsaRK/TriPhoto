import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DirectionSwipe } from './directions'
import { DIRECTIONS } from './directions'

// Lu depuis le disque (chemin relatif à la racine du projet, où Vitest s'exécute)
// pour vérifier que les variables de couleur utilisées ici existent bien dans
// le thème, avec la valeur attendue.
const theme = readFileSync('src/ui/theme.css', 'utf8')

const PALETTE_ATTENDUE: Record<DirectionSwipe, { variable: string; hex: string }> = {
  gauche: { variable: '--bleu', hex: '#405885' },
  droite: { variable: '--orange', hex: '#ffa530' },
  haut: { variable: '--vert-eau', hex: '#50aca2' },
  bas: { variable: '--rose', hex: '#e0748b' },
}

describe('table des directions de swipe', () => {
  it('contient exactement les quatre directions', () => {
    const directions = DIRECTIONS.map((info) => info.direction)

    expect(directions).toEqual(['gauche', 'droite', 'haut', 'bas'])
  })

  it('associe une couleur distincte à chaque direction', () => {
    const couleurs = DIRECTIONS.map((info) => info.couleur)

    expect(new Set(couleurs).size).toBe(DIRECTIONS.length)
  })

  it('donne un libellé non vide à chaque direction', () => {
    const libelles = DIRECTIONS.map((info) => info.libelle)

    expect(libelles.every((libelle) => libelle.length > 0)).toBe(true)
  })

  it('associe à chaque direction la variable de couleur attendue', () => {
    const associations = DIRECTIONS.map((info) => [info.direction, info.couleur])

    expect(associations).toEqual([
      ['gauche', 'var(--bleu)'],
      ['droite', 'var(--orange)'],
      ['haut', 'var(--vert-eau)'],
      ['bas', 'var(--rose)'],
    ])
  })

  it('déclare dans le thème chaque variable de couleur avec la bonne valeur', () => {
    const declarations = Object.values(PALETTE_ATTENDUE)

    for (const { variable, hex } of declarations) {
      expect(theme).toContain(`${variable}: ${hex};`)
    }
  })

  it('n’utilise plus aucune couleur de l’ancienne palette', () => {
    const anciennesCouleurs = ['#ffb94b', '#28b2c7', '#2b8d9c', '#33546c']

    for (const couleur of anciennesCouleurs) {
      expect(theme).not.toContain(couleur)
    }
  })
})
