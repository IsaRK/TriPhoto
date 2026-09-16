/**
 * Décisions liées au geste de swipe, isolées ici pour être testables sans
 * navigateur : à quelle direction correspond un déplacement du doigt, et de
 * combien la carte s'incline pendant qu'on la tire.
 */

import type { DirectionSwipe } from './directions'

/**
 * Distance à parcourir, en pixels, pour qu'un geste compte comme un swipe.
 * En dessous, la carte revient à sa place : sans cette marge, le moindre
 * tremblement du doigt en cliquant sur un bouton déclencherait un déplacement.
 */
export const SEUIL_DECLENCHEMENT = 90

/** Inclinaison maximale de la carte pendant le geste, en degrés. */
const ROTATION_MAX = 12

/** Nombre de pixels de déplacement pour un degré d'inclinaison. */
const PIXELS_PAR_DEGRE = 14

/**
 * Direction visée par un déplacement du doigt, ou `null` tant que le seuil
 * n'est pas franchi.
 *
 * L'axe qui a le plus bougé l'emporte : un geste part rarement tout droit, et
 * il faut bien trancher entre « gauche » et « haut » quand le doigt fait les
 * deux. À égalité parfaite on choisit l'horizontale, plus naturelle au pouce.
 */
export function directionDuGeste(
  ecartX: number,
  ecartY: number,
  seuil: number = SEUIL_DECLENCHEMENT,
): DirectionSwipe | null {
  if (Math.abs(ecartX) >= Math.abs(ecartY)) {
    if (Math.abs(ecartX) < seuil) {
      return null
    }
    return ecartX < 0 ? 'gauche' : 'droite'
  }

  if (Math.abs(ecartY) < seuil) {
    return null
  }
  return ecartY < 0 ? 'haut' : 'bas'
}

/**
 * Inclinaison de la carte, en degrés. Elle suit le déplacement horizontal, ce
 * qui donne l'impression de faire pivoter une photo posée sur la table, et
 * reste bornée pour que la carte ne parte jamais en vrille.
 */
export function rotationCarte(ecartX: number): number {
  const brute = ecartX / PIXELS_PAR_DEGRE
  return Math.max(-ROTATION_MAX, Math.min(ROTATION_MAX, brute))
}
