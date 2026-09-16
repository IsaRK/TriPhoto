import { DIRECTIONS } from '../tri/directions'
import type { DirectionSwipe } from '../tri/directions'

/**
 * Logo de TriPhoto : une photo entourée des quatre directions de swipe, chacune
 * dans sa couleur.
 *
 * Les couleurs viennent de `DIRECTIONS` et non de valeurs écrites ici : le logo
 * reste ainsi d'accord avec les pastilles de l'écran de configuration et les
 * overlays de l'écran de tri, même si la palette change.
 */

/** Une flèche par direction, dessinée autour de la photo. */
const FLECHES: Record<DirectionSwipe, string> = {
  gauche: 'M 2 22 L 10 15 L 10 29 Z',
  droite: 'M 46 22 L 38 15 L 38 29 Z',
  haut: 'M 24 0 L 17 8 L 31 8 Z',
  bas: 'M 24 44 L 17 36 L 31 36 Z',
}

export default function Logo() {
  return (
    <svg className="logo" viewBox="0 0 172 44" role="img" aria-label="TriPhoto">
      <rect
        x="14"
        y="12"
        width="20"
        height="20"
        rx="4"
        fill="none"
        stroke="var(--texte)"
        strokeWidth="2"
      />
      <circle cx="24" cy="22" r="4" fill="var(--texte)" />

      {DIRECTIONS.map((info) => (
        <path key={info.direction} d={FLECHES[info.direction]} fill={info.couleur} />
      ))}

      <text className="logo__mot" x="50" y="30">
        TriPhoto
      </text>
    </svg>
  )
}
