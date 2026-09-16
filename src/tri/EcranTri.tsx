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

type EtatChargement =
  | { statut: 'chargement' }
  | { statut: 'pret'; medias: MediaOneDrive[] }
  | { statut: 'sessionExpiree' }
  | { statut: 'erreur'; message: string }

/** Le dernier média envoyé à la poubelle, gardé pour pouvoir le récupérer. */
type Deplacement = {
  media: MediaOneDrive
  /** Position du média dans la liste, pour le réafficher après annulation. */
  index: number
}

/**
 * Écran de tri.
 *
 * On affiche les médias du dossier à trier, un par un, du plus ancien au plus
 * récent. « Delete » envoie le média vers le dossier Poubelle, « Recover » le
 * ramène dans le dossier à trier, « Skip » passe au suivant sans rien déplacer.
 * Les gestes de swipe vers les quatre destinations arrivent au lot suivant.
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
        titre="Tri impossible"
        message="Choisissez un dossier à trier, un dossier poubelle et au moins une destination avant de commencer."
      >
        <Link className="action" to="/">
          Aller à la configuration
        </Link>
      </EcranMessage>
    )
  }

  if (!compte) {
    return (
      <EcranMessage titre="Tri impossible" message="Connectez-vous pour trier vos médias.">
        <Link className="action" to="/">
          Aller à la configuration
        </Link>
      </EcranMessage>
    )
  }

  if (etat.statut === 'chargement') {
    return <EcranMessage titre="Tri" message={`Lecture de « ${source.nom} »…`} />
  }

  if (etat.statut === 'sessionExpiree') {
    return (
      <EcranMessage
        titre="Session expirée"
        message="Votre session Microsoft a expiré, ou TriPhoto a besoin d'une nouvelle autorisation."
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
          Se reconnecter
        </button>
      </EcranMessage>
    )
  }

  if (etat.statut === 'erreur') {
    return (
      <EcranMessage titre="Tri interrompu" message={etat.message}>
        <button type="button" className="action" onClick={() => setTentative(tentative + 1)}>
          Réessayer
        </button>
        <Link className="action action--discrete" to="/">
          Retour à la configuration
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
        titre="Rien à trier"
        message={`« ${source.nom} » ne contient aucune photo ni vidéo.`}
      >
        <Link className="action" to="/">
          Retour à la configuration
        </Link>
      </EcranMessage>
    )
  }

  if (index >= medias.length) {
    return (
      <EcranMessage titre="Tri terminé" message={decrireFin(medias.length)}>
        {/*
          Annuler reste possible ici : sans ce bouton, le dernier média envoyé à
          la poubelle ne pourrait plus jamais être récupéré depuis TriPhoto.
        */}
        {dernierDeplacement === null ? null : (
          <button type="button" className="action" onClick={annulerDernierDeplacement}>
            Recover
          </button>
        )}
        <button type="button" className="action" onClick={() => setIndex(0)}>
          Tout revoir
        </button>
        {erreurDeplacement === null ? null : (
          <p className="note" role="alert">
            {erreurDeplacement}
          </p>
        )}
        <Link className="action action--discrete" to="/">
          Retour à la configuration
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

  const passer = () => {
    if (deplacementEnCours) {
      return
    }
    setErreurDeplacement(null)
    setIndex(index + 1)
  }

  return (
    <main className="tri">
      <CarteMedia media={media} />

      {/*
        Le média suivant est demandé au navigateur dès maintenant, hors de
        l'écran : sans cela chaque « Passer » afficherait un cadre vide le temps
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
        Seul « Recover » peut être inactif : il n'a rien à annuler tant qu'aucun
        média n'a été envoyé à la poubelle.
      */}
      <button
        type="button"
        className="tri__coin tri__coin--annuler"
        onClick={annulerDernierDeplacement}
        disabled={dernierDeplacement === null}
      >
        Recover
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
          disabled
        >
          {destination.titre}
        </button>
      ))}
    </main>
  )
}

function CarteMedia({ media }: { media: MediaOneDrive }) {
  const url = urlAffichage(media)

  if (url === null) {
    return (
      <p className="tri__sans-media">
        Ce média ne peut pas être affiché : OneDrive n'a pas fourni de lien.
      </p>
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
  return nombre === 1 ? '1 média passé en revue.' : `${nombre} médias passés en revue.`
}

function decrireErreur(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'raison inconnue'
  return `Impossible de lire les médias de ce dossier : ${detail}`
}

function decrireEchecDeplacement(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'raison inconnue'
  return `Le déplacement a échoué : ${detail} Le média est resté en place, vous pouvez réessayer.`
}
