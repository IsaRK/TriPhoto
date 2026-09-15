/**
 * Table de référence des 4 directions de swipe.
 *
 * C'est la source de vérité unique des couleurs de direction : l'écran de
 * configuration y prend la pastille affichée à côté de chaque dossier de
 * destination, et l'écran de tri y prendra la couleur de l'overlay affiché
 * pendant le geste. Toute couleur de direction doit venir d'ici.
 */

export type DirectionSwipe = 'gauche' | 'droite' | 'haut' | 'bas'

export type InfoDirection = {
  direction: DirectionSwipe
  /** Libellé affiché à l'utilisateur. */
  libelle: string
  /** Couleur de la direction, sous forme de variable CSS du thème. */
  couleur: string
}

export const DIRECTIONS: readonly InfoDirection[] = [
  { direction: 'gauche', libelle: 'Gauche', couleur: 'var(--cyan)' },
  { direction: 'droite', libelle: 'Droite', couleur: 'var(--jaune)' },
  { direction: 'haut', libelle: 'Haut', couleur: 'var(--teal)' },
  { direction: 'bas', libelle: 'Bas', couleur: 'var(--bleu-fonce)' },
]
