/**
 * Petites décisions d'affichage de l'écran de tri, isolées ici pour être
 * testables sans navigateur ni réseau.
 */

import type { Configuration } from '../config/configuration'
import type { MediaOneDrive } from '../graph/medias'
import type { DirectionSwipe } from './directions'
import { DIRECTIONS } from './directions'

/** Une destination prête à être affichée à côté de sa direction. */
export type DestinationAffichee = {
  direction: DirectionSwipe
  /** Titre court saisi dans la configuration. */
  titre: string
  couleur: string
}

/**
 * Les destinations réellement configurées, dans l'ordre des directions. Une
 * direction sans dossier n'apparaît pas : rien ne se passerait si on swipait
 * vers elle.
 */
export function destinationsConfigurees(configuration: Configuration): DestinationAffichee[] {
  const destinations: DestinationAffichee[] = []
  for (const info of DIRECTIONS) {
    const dossier = configuration[info.direction]
    if (dossier !== null) {
      destinations.push({
        direction: info.direction,
        titre: dossier.titre,
        couleur: info.couleur,
      })
    }
  }
  return destinations
}

/**
 * Image à afficher : la miniature d'abord, bien plus légère que l'original —
 * une photo de téléphone pèse plusieurs mégaoctets, et on n'en montre qu'une
 * version plein écran. On retombe sur le fichier lui-même quand Graph n'a pas
 * encore produit de miniature.
 */
export function urlAffichage(media: MediaOneDrive): string | null {
  if (media.type === 'video') {
    return media.urlTelechargement
  }
  return media.urlMiniature ?? media.urlTelechargement
}

/** Date de prise de vue en toutes lettres, ex. « 14 July 2024 ». */
export function formaterDatePriseDeVue(priseLe: string | null): string {
  if (priseLe === null) {
    return 'Unknown date'
  }
  const instant = new Date(priseLe)
  if (Number.isNaN(instant.getTime())) {
    return 'Unknown date'
  }
  // L'écran de tri est en anglais ; « en-GB » donne « 14 July 2024 », dans
  // l'ordre jour-mois-année auquel l'utilisateur est habitué.
  return instant.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Avancement affiché, ex. « 12 / 340 ». */
export function formaterProgression(index: number, total: number): string {
  return `${index + 1} / ${total}`
}
