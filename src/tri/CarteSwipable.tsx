import type { ReactNode } from 'react'
import { useState } from 'react'
import type { DestinationAffichee } from './affichage'
import type { DirectionSwipe } from './directions'
import { directionDuGeste, rotationCarte } from './geste'

type Props = {
  /** Destinations réellement configurées : swiper ailleurs ne fait rien. */
  destinations: DestinationAffichee[]
  /** À faux, le média ne bouge plus : un déplacement est déjà en cours. */
  actif: boolean
  onSwipe: (direction: DirectionSwipe) => void
  children: ReactNode
}

/** Position du doigt au début du geste. */
type Depart = {
  pointerId: number
  x: number
  y: number
}

/**
 * La carte que l'on tire au doigt.
 *
 * Écrit avec les Pointer Events plutôt qu'avec une librairie : ils couvrent le
 * doigt, le stylet et la souris avec le même code, et le geste tient en
 * quelques lignes. `setPointerCapture` fait suivre le doigt même quand il
 * sort de la carte, sans quoi un geste rapide serait perdu en cours de route.
 */
export default function CarteSwipable({ destinations, actif, onSwipe, children }: Props) {
  const [depart, setDepart] = useState<Depart | null>(null)
  const [ecart, setEcart] = useState({ x: 0, y: 0 })

  const cible = trouverDestination(destinations, directionDuGeste(ecart.x, ecart.y))

  const relacher = () => {
    setDepart(null)
    setEcart({ x: 0, y: 0 })
  }

  const commencer = (evenement: React.PointerEvent<HTMLDivElement>) => {
    if (!actif) {
      return
    }
    setDepart({ pointerId: evenement.pointerId, x: evenement.clientX, y: evenement.clientY })
    setEcart({ x: 0, y: 0 })
    // jsdom ne connaît pas la capture de pointeur ; elle n'est pas indispensable
    // au geste, seulement à son confort.
    evenement.currentTarget.setPointerCapture?.(evenement.pointerId)
  }

  const suivre = (evenement: React.PointerEvent<HTMLDivElement>) => {
    if (depart === null || evenement.pointerId !== depart.pointerId) {
      return
    }
    setEcart({ x: evenement.clientX - depart.x, y: evenement.clientY - depart.y })
  }

  const terminer = (evenement: React.PointerEvent<HTMLDivElement>) => {
    if (depart === null || evenement.pointerId !== depart.pointerId) {
      return
    }
    const direction = directionDuGeste(ecart.x, ecart.y)
    const destination = trouverDestination(destinations, direction)
    relacher()
    if (destination !== undefined) {
      onSwipe(destination.direction)
    }
  }

  const enCours = depart !== null

  return (
    <div
      className="tri__carte"
      style={{
        transform: `translate(${ecart.x}px, ${ecart.y}px) rotate(${rotationCarte(ecart.x)}deg)`,
        // Pendant le geste la carte colle au doigt ; au relâchement elle
        // retrouve sa place en glissant.
        transition: enCours ? 'none' : 'transform 0.2s ease-out',
      }}
      onPointerDown={commencer}
      onPointerMove={suivre}
      onPointerUp={terminer}
      onPointerCancel={relacher}
    >
      {children}

      {/*
        L'overlay n'apparaît qu'une fois le seuil franchi : c'est ce qui dit
        « si tu lâches maintenant, la photo part là ». Tant qu'il est absent,
        le geste peut encore être abandonné.
      */}
      {cible === undefined ? null : (
        <div className="tri__cible">
          <div className="tri__cible-voile" style={{ backgroundColor: cible.couleur }} />
          <span className="tri__cible-titre" style={{ backgroundColor: cible.couleur }}>
            {cible.titre}
          </span>
        </div>
      )}
    </div>
  )
}

function trouverDestination(
  destinations: DestinationAffichee[],
  direction: DirectionSwipe | null,
): DestinationAffichee | undefined {
  if (direction === null) {
    return undefined
  }
  return destinations.find((destination) => destination.direction === direction)
}
