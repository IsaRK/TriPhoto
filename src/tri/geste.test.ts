import { describe, expect, it } from 'vitest'
import { directionDuGeste, rotationCarte, SEUIL_DECLENCHEMENT } from './geste'

describe('direction du geste', () => {
  it('ne déclenche rien tant que le seuil n’est pas franchi', () => {
    expect(directionDuGeste(0, 0)).toBeNull()
    expect(directionDuGeste(SEUIL_DECLENCHEMENT - 1, 0)).toBeNull()
    expect(directionDuGeste(0, -(SEUIL_DECLENCHEMENT - 1))).toBeNull()
  })

  it('déclenche exactement au seuil', () => {
    expect(directionDuGeste(SEUIL_DECLENCHEMENT, 0)).toBe('droite')
  })

  it('reconnaît les quatre directions', () => {
    expect(directionDuGeste(-120, 0)).toBe('gauche')
    expect(directionDuGeste(120, 0)).toBe('droite')
    expect(directionDuGeste(0, -120)).toBe('haut')
    expect(directionDuGeste(0, 120)).toBe('bas')
  })

  it('retient l’axe qui a le plus bougé quand le geste part en diagonale', () => {
    expect(directionDuGeste(-140, -100)).toBe('gauche')
    expect(directionDuGeste(-100, -140)).toBe('haut')
  })

  // Un geste de 100 px en diagonale parfaite parcourt 100 px sur chaque axe :
  // les deux franchissent le seuil, il faut quand même n'en garder qu'un.
  it('tranche pour l’horizontale quand les deux axes sont à égalité', () => {
    expect(directionDuGeste(-120, -120)).toBe('gauche')
    expect(directionDuGeste(120, 120)).toBe('droite')
  })

  it('accepte un seuil différent', () => {
    expect(directionDuGeste(30, 0, 20)).toBe('droite')
    expect(directionDuGeste(30, 0, 40)).toBeNull()
  })
})

describe('inclinaison de la carte', () => {
  it('ne penche pas au repos', () => {
    expect(rotationCarte(0)).toBe(0)
  })

  it('penche dans le sens du déplacement', () => {
    expect(rotationCarte(70)).toBeGreaterThan(0)
    expect(rotationCarte(-70)).toBeLessThan(0)
  })

  it('reste bornée même sur un geste très long', () => {
    expect(rotationCarte(2000)).toBe(12)
    expect(rotationCarte(-2000)).toBe(-12)
  })
})
