import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIRECTIONS } from './directions'

// Lu depuis le disque (chemin relatif à la racine du projet, où Vitest s'exécute)
// pour vérifier que les variables utilisées ici existent bien dans le thème.
const theme = readFileSync('src/ui/theme.css', 'utf8')

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

  it('utilise uniquement des variables CSS réellement déclarées dans le thème', () => {
    const variablesUtilisees = DIRECTIONS.map((info) => info.couleur.replace('var(', '').replace(')', ''))

    for (const variable of variablesUtilisees) {
      expect(theme).toContain(`${variable}:`)
    }
  })
})
