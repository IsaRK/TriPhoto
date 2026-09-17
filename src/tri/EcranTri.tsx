import { useMsal } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estInteractionRequise, recupererJetonAcces, SCOPES } from '../auth/msal'
import { lireConfiguration, peutCommencerLeTri } from '../config/configuration'
import { deplacerElement } from '../graph/deplacements'
import type { MediaOneDrive } from '../graph/medias'
import { listerMedias, relireMedia } from '../graph/medias'
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

/** Un média déplacé, gardé pour pouvoir le récupérer. */
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
  /**
   * Les déplacements faits pendant cette session de tri, du plus ancien au plus
   * récent. On dépile à chaque annulation, ce qui permet de remonter plusieurs
   * photos de suite et pas seulement la dernière.
   */
  const [deplacements, setDeplacements] = useState<Deplacement[]>([])
  const [deplacementEnCours, setDeplacementEnCours] = useState(false)
  const [erreurDeplacement, setErreurDeplacement] = useState<string | null>(null)
  /**
   * URL d'affichage déjà signalées comme cassées. La carte et le préchargement
   * peuvent échouer sur le même lien à quelques instants d'intervalle : sans
   * cette liste, le second échec serait pris pour un échec du lien frais.
   */
  const [urlsCassees, setUrlsCassees] = useState<string[]>([])
  /** Médias dont on a déjà redemandé un lien frais : on ne le fait qu'une fois. */
  const [idsRafraichis, setIdsRafraichis] = useState<string[]>([])
  /** Médias qui n'ont pas pu être affichés, même avec un lien frais. */
  const [idsIllisibles, setIdsIllisibles] = useState<string[]>([])

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
          // Une nouvelle liste, c'est une nouvelle session de tri : les
          // positions mémorisées dans la pile ne voudraient plus rien dire.
          setDeplacements([])
          setUrlsCassees([])
          setIdsRafraichis([])
          setIdsIllisibles([])
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
   * Appelé quand le navigateur n'arrive pas à charger une image ou une vidéo.
   *
   * La cause de loin la plus fréquente est l'expiration du lien signé par Graph,
   * au bout d'environ une heure de tri. On redemande donc un lien frais pour ce
   * seul média, et l'affichage repart tout seul dès que la liste est mise à
   * jour : l'utilisateur ne voit qu'un bref clignotement.
   *
   * On raisonne sur l'URL et non sur le média : la carte et le préchargement
   * peuvent buter sur le même lien pendant que la relecture est en route, et ce
   * second échec ne dit rien de neuf. Seul un échec sur une URL jamais vue
   * compte, et il n'y a qu'une relecture par média et par passe : le lien frais
   * qui casse à son tour signifie autre chose qu'une expiration — fichier
   * supprimé entre-temps, format que le navigateur ne sait pas lire — et
   * réessayer en boucle ne ferait que marteler Graph.
   */
  const signalerEchecChargement = (aRecharger: MediaOneDrive) => {
    const url = urlAffichage(aRecharger)

    if (url === null || urlsCassees.includes(url)) {
      return
    }

    setUrlsCassees((precedentes) => [...precedentes, url])

    if (idsRafraichis.includes(aRecharger.id)) {
      setIdsIllisibles((precedents) => [...precedents, aRecharger.id])
      return
    }

    setIdsRafraichis((precedents) => [...precedents, aRecharger.id])

    recupererJetonAcces(instance, compte)
      .then((jeton) => relireMedia(jeton, aRecharger.driveId, aRecharger.id))
      .then((frais) => {
        // Remplacement à la même place : la position dans le tri et la pile
        // d'annulation ne bougent pas.
        setEtat((precedent) =>
          precedent.statut === 'pret'
            ? {
                statut: 'pret',
                medias: precedent.medias.map((existant) =>
                  existant.id === frais.id ? frais : existant,
                ),
              }
            : precedent,
        )
      })
      .catch((erreur: unknown) => {
        // Une session Microsoft expire elle aussi au bout d'une heure : c'est
        // le même moment, mais pas le même problème. Le dire franchement évite
        // d'accuser les médias les uns après les autres.
        if (estInteractionRequise(erreur)) {
          setEtat({ statut: 'sessionExpiree' })
          return
        }
        setIdsIllisibles((precedents) => [...precedents, aRecharger.id])
      })
  }

  /**
   * Repart du premier média. Les échecs de chargement de la passe précédente
   * sont oubliés : les liens renouvelés il y a une heure ont pu expirer à leur
   * tour, et un média jugé illisible mérite une seconde chance.
   *
   * La pile d'annulation est vidée elle aussi. Elle mémorise des positions dans
   * la liste, or on vient de revenir au début : garder ces positions ferait
   * sauter l'annulation en avant, et pourrait ressortir de son dossier un média
   * déjà rangé lors de la passe précédente.
   */
  const reprendreDepuisLeDebut = () => {
    setIndex(0)
    setDeplacements([])
    setUrlsCassees([])
    setIdsRafraichis([])
    setIdsIllisibles([])
  }

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
   * Annule le dernier déplacement en date : le média retourne dans le dossier à
   * trier et s'affiche de nouveau. On dépile ensuite, si bien qu'un second appui
   * remonte le déplacement d'avant, puis celui d'encore avant.
   *
   * Le média n'est retiré de la pile qu'une fois Graph d'accord : un échec
   * réseau ne doit pas faire perdre la possibilité de réessayer.
   */
  const annulerDernierDeplacement = () => {
    const dernier = deplacements[deplacements.length - 1]

    if (deplacementEnCours || dernier === undefined) {
      return
    }

    executerDeplacement(dernier.media, source, () => {
      setDeplacements((precedents) => precedents.slice(0, -1))
      setIndex(dernier.index)
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
          « Cancel last action » reste possible ici : sans ce bouton, les derniers
          médias envoyés à la poubelle ne pourraient plus jamais être récupérés
          depuis TriPhoto.
        */}
        {deplacements.length === 0 ? null : (
          <button type="button" className="action" onClick={annulerDernierDeplacement}>
            Cancel last action
          </button>
        )}
        <button type="button" className="action" onClick={reprendreDepuisLeDebut}>
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
      setDeplacements((precedents) => [...precedents, { media, index }])
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
      setDeplacements((precedents) => [...precedents, { media, index }])
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
        <CarteMedia
          media={media}
          illisible={idsIllisibles.includes(media.id)}
          onEchecChargement={signalerEchecChargement}
        />
      </CarteSwipable>

      <RaccourcisClavier onDirection={envoyerVersDirection} />

      {/*
        Le média suivant est demandé au navigateur dès maintenant, hors de
        l'écran : sans cela chaque « Skip » afficherait un cadre vide le temps
        du téléchargement.
      */}
      {suivant ? (
        <PrechargementMedia media={suivant} onEchecChargement={signalerEchecChargement} />
      ) : null}

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
        tant qu'aucun média n'a été déplacé. Il reste actif tant que la pile
        n'est pas vide, ce qui permet de remonter plusieurs photos de suite.
      */}
      <button
        type="button"
        className="tri__coin tri__coin--annuler"
        onClick={annulerDernierDeplacement}
        disabled={deplacements.length === 0}
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

function CarteMedia({
  media,
  illisible,
  onEchecChargement,
}: {
  media: MediaOneDrive
  illisible: boolean
  onEchecChargement: (media: MediaOneDrive) => void
}) {
  const url = urlAffichage(media)

  if (url === null) {
    return (
      <p className="tri__sans-media">This item cannot be shown: OneDrive did not provide a link.</p>
    )
  }

  if (illisible) {
    return (
      <p className="tri__sans-media">
        This item could not be loaded, even with a fresh link from OneDrive. You can still sort it.
      </p>
    )
  }

  const surEchec = () => onEchecChargement(media)

  if (media.type === 'video') {
    return <video className="tri__media" src={url} controls preload="metadata" onError={surEchec} />
  }

  return <img className="tri__media" src={url} alt={media.nom} onError={surEchec} />
}

/**
 * Charge le média suivant sans l'afficher. Une image suffit à remplir le cache
 * du navigateur ; pour une vidéo on se contente des métadonnées, télécharger le
 * fichier entier coûterait cher en données mobiles.
 *
 * Son échec est signalé comme celui de la carte : si le lien du suivant a
 * expiré, autant le renouveler maintenant plutôt qu'au moment de l'afficher.
 */
function PrechargementMedia({
  media,
  onEchecChargement,
}: {
  media: MediaOneDrive
  onEchecChargement: (media: MediaOneDrive) => void
}) {
  const url = urlAffichage(media)

  if (url === null) {
    return null
  }

  const surEchec = () => onEchecChargement(media)

  if (media.type === 'video') {
    return (
      <video
        className="prechargement"
        src={url}
        preload="metadata"
        aria-hidden="true"
        onError={surEchec}
      />
    )
  }

  return <img className="prechargement" src={url} alt="" aria-hidden="true" onError={surEchec} />
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
