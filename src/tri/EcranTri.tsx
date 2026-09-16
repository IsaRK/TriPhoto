import { useMsal } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estInteractionRequise, recupererJetonAcces, SCOPES } from '../auth/msal'
import { lireConfiguration, peutCommencerLeTri } from '../config/configuration'
import { deplacerElement } from '../graph/deplacements'
import type { MediaOneDrive } from '../graph/medias'
import { listerMedias } from '../graph/medias'
import EcranMessage from '../ui/EcranMessage'
import {
  destinationsConfigurees,
  formaterDatePriseDeVue,
  formaterProgression,
  urlAffichage,
} from './affichage'
import CarteSwipable from './CarteSwipable'
import type { DirectionSwipe } from './directions'

type EtatChargement =
  | { statut: 'chargement' }
  | { statut: 'pret'; medias: MediaOneDrive[] }
  | { statut: 'sessionExpiree' }
  | { statut: 'erreur'; message: string }

/** Le dernier média déplacé, gardé pour pouvoir le récupérer. */
type Deplacement = {
  media: MediaOneDrive
  /** Position du média dans la liste, pour le réafficher après annulation. */
  index: number
}

/**
 * Écran de tri.
 *
 * On affiche les médias du dossier à trier, un par un, du plus ancien au plus
 * récent. On swipe le média vers l'un des quatre dossiers de destination, ou
 * l'on utilise les boutons des coins : « Delete » l'envoie vers la Poubelle,
 * « Cancel last action » ramène le dernier média déplacé, « Skip » passe au
 * suivant sans rien déplacer.
 */
export default function EcranTri() {
  const { instance, accounts } = useMsal()
  const compte = accounts[0]
  const idCompte = compte?.homeAccountId
  const [configuration] = useState(lireConfiguration)
  const [etat, setEtat] = useState<EtatChargement>({ statut: 'chargement' })
  const [index, setIndex] = useState(0)
  const [tentative, setTentative] = useState(0)
  const [dernierDeplacement, setDernierDeplacement] = useState<Deplacement | null>(null)
  const [deplacementEnCours, setDeplacementEnCours] = useState(false)
  const [erreurDeplacement, setErreurDeplacement] = useState<string | null>(null)

  const source = configuration.source

  useEffect(() => {
    if (!compte || source === null || !peutCommencerLeTri(configuration)) {
      return
    }

    let annule = false
    setEtat({ statut: 'chargement' })

    recupererJetonAcces(instance, compte)
      .then((jeton) => listerMedias(jeton, source.driveId, source.id))
      .then((medias) => {
        if (!annule) {
          setEtat({ statut: 'pret', medias })
          setIndex(0)
        }
      })
      .catch((erreur: unknown) => {
        if (annule) {
          return
        }
        setEtat(
          estInteractionRequise(erreur)
            ? { statut: 'sessionExpiree' }
            : { statut: 'erreur', message: decrireErreur(erreur) },
        )
      })

    return () => {
      annule = true
    }
  }, [instance, idCompte, source, tentative])

  if (!peutCommencerLeTri(configuration) || source === null || configuration.poubelle === null) {
    return (
      <EcranMessage
        titre="Cannot sort"
        message="Choose a folder to sort, a trash folder and at least one destination before starting."
      >
        <Link className="action" to="/">
          Go to settings
        </Link>
      </EcranMessage>
    )
  }

  if (!compte) {
    return (
      <EcranMessage titre="Cannot sort" message="Sign in to sort your media.">
        <Link className="action" to="/">
          Go to settings
        </Link>
      </EcranMessage>
    )
  }

  if (etat.statut === 'chargement') {
    return <EcranMessage titre="Sorting" message={`Reading “${source.nom}”…`} />
  }

  if (etat.statut === 'sessionExpiree') {
    return (
      <EcranMessage
        titre="Session expired"
        message="Your Microsoft session has expired, or TriPhoto needs to be authorized again."
      >
        <button
          type="button"
          className="action"
          onClick={() => {
            instance.loginRedirect({ scopes: SCOPES }).catch((erreur: unknown) => {
              setEtat({ statut: 'erreur', message: decrireErreur(erreur) })
            })
          }}
        >
          Sign in again
        </button>
      </EcranMessage>
    )
  }

  if (etat.statut === 'erreur') {
    return (
      <EcranMessage titre="Sorting stopped" message={etat.message}>
        <button type="button" className="action" onClick={() => setTentative(tentative + 1)}>
          Try again
        </button>
        <Link className="action action--discrete" to="/">
          Back to settings
        </Link>
      </EcranMessage>
    )
  }

  const medias = etat.medias

  /**
   * Exécute un déplacement Graph. L'échec n'efface ni la liste ni le média
   * mémorisé pour l'annulation : il affiche un message et laisse tout en place,
   * pour qu'un réseau capricieux ne coûte pas le travail déjà fait.
   */
  const executerDeplacement = (
    aDeplacer: MediaOneDrive,
    destination: { driveId: string; id: string },
    apresSucces: () => void,
  ) => {
    setDeplacementEnCours(true)
    setErreurDeplacement(null)

    recupererJetonAcces(instance, compte)
      .then((jeton) => deplacerElement(jeton, aDeplacer.driveId, aDeplacer.id, destination))
      .then(() => {
        setDeplacementEnCours(false)
        apresSucces()
      })
      .catch((erreur: unknown) => {
        setDeplacementEnCours(false)
        setErreurDeplacement(decrireEchecDeplacement(erreur))
      })
  }

  /**
   * Annule le dernier « Delete » : le média retourne dans le dossier à trier et
   * s'affiche de nouveau. On ne remonte pas plus loin — seule la dernière
   * suppression est rattrapable, les précédentes sont acquises.
   */
  const annulerDernierDeplacement = () => {
    if (deplacementEnCours || dernierDeplacement === null) {
      return
    }
    executerDeplacement(dernierDeplacement.media, source, () => {
      setDernierDeplacement(null)
      setIndex(dernierDeplacement.index)
    })
  }

  if (medias.length === 0) {
    return (
      <EcranMessage
        titre="Nothing to sort"
        message={`“${source.nom}” contains no photos or videos.`}
      >
        <Link className="action" to="/">
          Back to settings
        </Link>
      </EcranMessage>
    )
  }

  if (index >= medias.length) {
    return (
      <EcranMessage titre="Sorting complete" message={decrireFin(medias.length)}>
        {/*
          « Cancel last action » reste possible ici : sans ce bouton, le dernier
          média envoyé à la poubelle ne pourrait plus jamais être récupéré depuis
          TriPhoto.
        */}
        {dernierDeplacement === null ? null : (
          <button type="button" className="action" onClick={annulerDernierDeplacement}>
            Cancel last action
          </button>
        )}
        <button type="button" className="action" onClick={() => setIndex(0)}>
          Review again
        </button>
        {erreurDeplacement === null ? null : (
          <p className="note" role="alert">
            {erreurDeplacement}
          </p>
        )}
        <Link className="action action--discrete" to="/">
          Back to settings
        </Link>
      </EcranMessage>
    )
  }

  const media = medias[index]
  const suivant = medias[index + 1]
  const destinations = destinationsConfigurees(configuration)
  const poubelle = configuration.poubelle

  const envoyerALaPoubelle = () => {
    if (deplacementEnCours) {
      return
    }
    executerDeplacement(media, poubelle, () => {
      setDernierDeplacement({ media, index })
      setIndex(index + 1)
    })
  }

  /**
   * Range le média dans le dossier d'une direction. Swiper vers une direction
   * sans dossier ne fait rien : il n'y a nulle part où envoyer la photo.
   */
  const envoyerVersDirection = (direction: DirectionSwipe) => {
    if (deplacementEnCours) {
      return
    }
    const dossier = configuration[direction]
    if (dossier === null) {
      return
    }
    executerDeplacement(media, dossier, () => {
      setDernierDeplacement({ media, index })
      setIndex(index + 1)
    })
  }

  const passer = () => {
    if (deplacementEnCours) {
      return
    }
    setErreurDeplacement(null)
    setIndex(index + 1)
  }

  return (
    <main className="tri">
      <CarteSwipable
        destinations={destinations}
        actif={!deplacementEnCours}
        onSwipe={envoyerVersDirection}
      >
        <CarteMedia media={media} />
      </CarteSwipable>

      <RaccourcisClavier onDirection={envoyerVersDirection} />

      {/*
        Le média suivant est demandé au navigateur dès maintenant, hors de
        l'écran : sans cela chaque « Skip » afficherait un cadre vide le temps
        du téléchargement.
      */}
      {suivant ? <PrechargementMedia media={suivant} /> : null}

      <p className="tri__infos">
        <span className="tri__progression">{formaterProgression(index, medias.length)}</span>
        <span className="tri__date">{formaterDatePriseDeVue(media.priseLe)}</span>
      </p>

      {erreurDeplacement === null ? null : (
        <p className="tri__erreur" role="alert">
          {erreurDeplacement}
        </p>
      )}

      <Link className="tri__coin tri__coin--retour" to="/">
        Home
      </Link>

      {/*
        Seul « Cancel last action » peut être inactif : il n'a rien à annuler
        tant qu'aucun média n'a été envoyé à la poubelle.
      */}
      <button
        type="button"
        className="tri__coin tri__coin--annuler"
        onClick={annulerDernierDeplacement}
        disabled={dernierDeplacement === null}
      >
        {/* Coupé en deux lignes : d'un seul tenant, le libellé barrerait le bas
            de l'écran et toucherait la pastille de la direction du bas. */}
        <span>Cancel</span>
        <span>last action</span>
      </button>

      <button type="button" className="tri__coin tri__coin--poubelle" onClick={envoyerALaPoubelle}>
        Delete
      </button>

      <button type="button" className="tri__coin tri__coin--passer" onClick={passer}>
        Skip
      </button>

      {destinations.map((destination) => (
        <button
          key={destination.direction}
          type="button"
          className={`tri__bord tri__bord--${destination.direction}`}
          style={{ backgroundColor: destination.couleur }}
          onClick={() => envoyerVersDirection(destination.direction)}
        >
          {destination.titre}
        </button>
      ))}
    </main>
  )
}

/** Touche du clavier à laquelle répond chaque direction. */
const DIRECTION_PAR_TOUCHE: Record<string, DirectionSwipe> = {
  ArrowLeft: 'gauche',
  ArrowRight: 'droite',
  ArrowUp: 'haut',
  ArrowDown: 'bas',
}

/**
 * Branche les flèches du clavier sur les quatre directions. Sert surtout à
 * essayer le tri sur un ordinateur, où l'on n'a pas de doigt à faire glisser.
 *
 * C'est un composant plutôt qu'un `useEffect` dans l'écran de tri : l'écran
 * rend plusieurs écrans de message avant d'arriver à la carte, et un hook
 * placé après ces retours anticipés serait interdit.
 */
function RaccourcisClavier({ onDirection }: { onDirection: (direction: DirectionSwipe) => void }) {
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      const direction = DIRECTION_PAR_TOUCHE[evenement.key]
      if (direction === undefined) {
        return
      }
      // Sans cela, les flèches feraient aussi défiler la page.
      evenement.preventDefault()
      onDirection(direction)
    }

    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onDirection])

  return null
}

function CarteMedia({ media }: { media: MediaOneDrive }) {
  const url = urlAffichage(media)

  if (url === null) {
    return (
      <p className="tri__sans-media">This item cannot be shown: OneDrive did not provide a link.</p>
    )
  }

  if (media.type === 'video') {
    return <video className="tri__media" src={url} controls preload="metadata" />
  }

  return <img className="tri__media" src={url} alt={media.nom} />
}

/**
 * Charge le média suivant sans l'afficher. Une image suffit à remplir le cache
 * du navigateur ; pour une vidéo on se contente des métadonnées, télécharger le
 * fichier entier coûterait cher en données mobiles.
 */
function PrechargementMedia({ media }: { media: MediaOneDrive }) {
  const url = urlAffichage(media)

  if (url === null) {
    return null
  }

  if (media.type === 'video') {
    return <video className="prechargement" src={url} preload="metadata" aria-hidden="true" />
  }

  return <img className="prechargement" src={url} alt="" aria-hidden="true" />
}

function decrireFin(nombre: number): string {
  return nombre === 1 ? '1 item reviewed.' : `${nombre} items reviewed.`
}

function decrireErreur(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'unknown reason'
  return `Could not read the media in this folder: ${detail}`
}

function decrireEchecDeplacement(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'unknown reason'
  return `The move failed: ${detail} The item stayed where it was, you can try again.`
}
