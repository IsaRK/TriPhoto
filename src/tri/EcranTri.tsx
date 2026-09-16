import { useMsal } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estInteractionRequise, recupererJetonAcces, SCOPES } from '../auth/msal'
import { lireConfiguration, peutCommencerLeTri } from '../config/configuration'
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

/**
 * Écran de tri.
 *
 * Lot 5 : on affiche les médias du dossier à trier, un par un, du plus ancien
 * au plus récent. Les gestes de swipe et les déplacements vers les dossiers de
 * destination arriveront aux lots suivants ; pour l'instant seul « Passer »
 * fait avancer.
 */
export default function EcranTri() {
  const { instance, accounts } = useMsal()
  const compte = accounts[0]
  const idCompte = compte?.homeAccountId
  const [configuration] = useState(lireConfiguration)
  const [etat, setEtat] = useState<EtatChargement>({ statut: 'chargement' })
  const [index, setIndex] = useState(0)
  const [tentative, setTentative] = useState(0)

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

  if (!peutCommencerLeTri(configuration) || source === null) {
    return (
      <EcranMessage
        titre="Tri impossible"
        message="Choisissez un dossier à trier et au moins une destination avant de commencer."
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
        <button type="button" className="action" onClick={() => setIndex(0)}>
          Tout revoir
        </button>
        <Link className="action action--discrete" to="/">
          Retour à la configuration
        </Link>
      </EcranMessage>
    )
  }

  const media = medias[index]
  const suivant = medias[index + 1]
  const destinations = destinationsConfigurees(configuration)

  return (
    <main className="ecran ecran--tri">
      <header className="barre-tri">
        <Link className="barre-tri__retour" to="/" aria-label="Retour à la configuration">
          ‹
        </Link>
        <span className="barre-tri__progression">{formaterProgression(index, medias.length)}</span>
        <span className="barre-tri__date">{formaterDatePriseDeVue(media.priseLe)}</span>
      </header>

      <div className="carte">
        <CarteMedia media={media} />
      </div>

      {/*
        Le média suivant est demandé au navigateur dès maintenant, hors de
        l'écran : sans cela chaque « Passer » afficherait un cadre vide le temps
        du téléchargement.
      */}
      {suivant ? <PrechargementMedia media={suivant} /> : null}

      <ul className="legende">
        {destinations.map((destination) => (
          <li className="legende__element" key={destination.direction}>
            <span
              className={`legende__pastille legende__pastille--${destination.direction}`}
              style={{ backgroundColor: destination.couleur }}
              aria-hidden="true"
            />
            <span className="legende__titre">{destination.titre}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="action" onClick={() => setIndex(index + 1)}>
        Passer
      </button>
    </main>
  )
}

function CarteMedia({ media }: { media: MediaOneDrive }) {
  const url = urlAffichage(media)

  if (url === null) {
    return <p className="note">Ce média ne peut pas être affiché : OneDrive n'a pas fourni de lien.</p>
  }

  if (media.type === 'video') {
    return <video className="carte__media" src={url} controls preload="metadata" />
  }

  return <img className="carte__media" src={url} alt={media.nom} />
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
