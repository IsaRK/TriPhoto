import { useMsal } from '@azure/msal-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CompteMicrosoft from '../auth/CompteMicrosoft'
import { DIRECTIONS } from '../tri/directions'
import Logo from '../ui/Logo'
import type { Configuration, DossierChoisi, DossierConfigure, Emplacement } from './configuration'
import {
  compterDestinations,
  definirDossier,
  definirTitre,
  ecrireConfiguration,
  emplacementDejaUtilise,
  lireConfiguration,
  normaliserTitre,
  peutCommencerLeTri,
  retirerDossier,
  titreParDefaut,
  TITRE_LONGUEUR_MAX,
} from './configuration'
import ExplorateurDossiers from './ExplorateurDossiers'

type LigneEmplacement = {
  emplacement: Emplacement
  libelle: string
  /**
   * `null` pour les emplacements qui ne correspondent pas à une direction.
   * Une couleur signale donc aussi les quatre lignes qui portent un titre court.
   */
  couleur: string | null
}

/**
 * Les lignes de l'écran, dans l'ordre d'affichage. Les couleurs des quatre
 * destinations viennent de la table des directions : c'est la même source de
 * vérité que l'écran de tri.
 */
const LIGNES: readonly LigneEmplacement[] = [
  { emplacement: 'source', libelle: 'Folder to sort', couleur: null },
  ...DIRECTIONS.map((info) => ({
    emplacement: info.direction,
    libelle: info.libelle,
    couleur: info.couleur,
  })),
  { emplacement: 'poubelle', libelle: 'Trash', couleur: null },
]

const MESSAGE_STOCKAGE_REFUSE =
  'Your browser refuses to save the configuration: it will be lost on the next ' +
  'reload. This happens in private browsing, or when site storage is blocked.'

const MESSAGE_FERMETURE_REFUSEE =
  'Your browser refuses to close a tab it did not open itself. Close it by hand, ' +
  'or install TriPhoto on your home screen: the installed version closes normally.'

export default function EcranAccueil() {
  const { accounts } = useMsal()
  const navigate = useNavigate()
  const estConnecte = accounts.length > 0
  const [configuration, setConfiguration] = useState<Configuration>(lireConfiguration)
  const [emplacementEnCours, setEmplacementEnCours] = useState<Emplacement | null>(null)
  const [avertissement, setAvertissement] = useState<string | null>(null)
  const manque = decrireCeQuiManque(configuration)

  const enregistrer = (nouvelle: Configuration) => {
    setConfiguration(nouvelle)
    setAvertissement(ecrireConfiguration(nouvelle) ? null : MESSAGE_STOCKAGE_REFUSE)
  }

  const ouvrirExplorateur = (emplacement: Emplacement) => {
    setAvertissement(null)
    setEmplacementEnCours(emplacement)
  }

  /**
   * Ferme l'application. Un navigateur n'autorise `window.close()` que sur les
   * fenêtres qu'il a lui-même ouvertes : depuis un onglet ordinaire la page
   * reste donc affichée, et l'on préfère le dire plutôt que de laisser croire à
   * un bouton cassé. Installée sur l'écran d'accueil, l'application se ferme.
   */
  const quitter = () => {
    window.close()
    window.setTimeout(() => {
      if (!window.closed) {
        setAvertissement(MESSAGE_FERMETURE_REFUSEE)
      }
    }, 200)
  }

  const choisirDossier = (choisi: DossierChoisi) => {
    if (emplacementEnCours === null) {
      return
    }
    const occupant = emplacementDejaUtilise(configuration, emplacementEnCours, choisi)
    if (occupant !== null) {
      setAvertissement(
        `“${choisi.nom}” is already used for “${libelleDe(occupant)}”. Choose another folder.`,
      )
      return
    }
    const dossier: DossierConfigure = {
      ...choisi,
      titre: titreParDefaut(choisi.nom),
    }
    enregistrer(definirDossier(configuration, emplacementEnCours, dossier))
    setEmplacementEnCours(null)
  }

  const retirer = (emplacement: Emplacement) =>
    enregistrer(retirerDossier(configuration, emplacement))

  const renommer = (emplacement: Emplacement, titre: string) =>
    enregistrer(definirTitre(configuration, emplacement, titre))

  const finirRenommage = (emplacement: Emplacement) =>
    enregistrer(normaliserTitre(configuration, emplacement))

  if (estConnecte && emplacementEnCours !== null) {
    return (
      <main className="ecran">
        <BoutonQuitter onQuitter={quitter} />
        <header>
          <h1 className="titre">{libelleDe(emplacementEnCours)}</h1>
          <p className="accroche">Open a folder, then confirm it.</p>
        </header>

        {avertissement !== null ? (
          <p className="avertissement" role="alert">
            {avertissement}
          </p>
        ) : null}

        <ExplorateurDossiers key={emplacementEnCours} onChoisir={choisirDossier} />

        <button
          type="button"
          className="action action--discrete"
          onClick={() => setEmplacementEnCours(null)}
        >
          Cancel
        </button>
      </main>
    )
  }

  return (
    <main className={estConnecte ? 'ecran' : 'ecran ecran--accueil'}>
      {/* Avant connexion, l'écran ne montre que le logo et le bouton de
          connexion : une croix de fermeture y serait la seule autre chose à
          cliquer, sans rien à quitter. */}
      {estConnecte ? <BoutonQuitter onQuitter={quitter} /> : null}
      <header className={estConnecte ? undefined : 'entete--grand'}>
        <h1 className="titre-logo">
          <Logo />
        </h1>
      </header>

      <div className="contenu">
        {avertissement !== null ? (
          <p className="avertissement" role="alert">
            {avertissement}
          </p>
        ) : null}

        {estConnecte ? (
          <ul className="emplacements">
            {LIGNES.map((ligne) => (
              <LigneDossier
                key={ligne.emplacement}
                ligne={ligne}
                dossier={configuration[ligne.emplacement]}
                onOuvrir={() => ouvrirExplorateur(ligne.emplacement)}
                onRetirer={() => retirer(ligne.emplacement)}
                onRenommer={(titre) => renommer(ligne.emplacement, titre)}
                onFinirRenommage={() => finirRenommage(ligne.emplacement)}
              />
            ))}
          </ul>
        ) : null}
      </div>

      <div className="pile">
        {estConnecte ? (
          <>
            <button
              type="button"
              className="action"
              disabled={!peutCommencerLeTri(configuration)}
              onClick={() => navigate('/tri')}
            >
              Start sorting
            </button>
            {manque === null ? null : <p className="note">{manque}</p>}
          </>
        ) : null}
        <CompteMicrosoft />
      </div>
    </main>
  )
}

/** Croix « Exit » du coin haut droit : elle ferme l'application. */
function BoutonQuitter({ onQuitter }: { onQuitter: () => void }) {
  return (
    <button type="button" className="quitter" onClick={onQuitter} aria-label="Exit" title="Exit">
      <svg className="quitter__croix" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6 18 18" />
        <path d="M18 6 6 18" />
      </svg>
    </button>
  )
}

function LigneDossier({
  ligne,
  dossier,
  onOuvrir,
  onRetirer,
  onRenommer,
  onFinirRenommage,
}: {
  ligne: LigneEmplacement
  dossier: DossierConfigure | null
  onOuvrir: () => void
  onRetirer: () => void
  onRenommer: (titre: string) => void
  onFinirRenommage: () => void
}) {
  return (
    <li className="emplacement">
      <div className="emplacement__ligne">
        <button type="button" className="emplacement__choix" onClick={onOuvrir}>
          <span
            className={
              ligne.couleur === null
                ? 'emplacement__puce'
                : `emplacement__pastille emplacement__pastille--${ligne.emplacement}`
            }
            style={ligne.couleur === null ? undefined : { backgroundColor: ligne.couleur }}
            aria-hidden="true"
          />
          <span className="emplacement__textes">
            <span className="emplacement__libelle">{ligne.libelle}</span>
            <span className="emplacement__dossier">
              {dossier === null ? 'No folder' : dossier.chemin}
            </span>
          </span>
        </button>
        {dossier === null ? null : (
          <button
            type="button"
            className="emplacement__retirer"
            onClick={onRetirer}
            aria-label={`Remove the folder for “${ligne.libelle}”`}
          >
            ✕
          </button>
        )}
      </div>

      {dossier !== null && ligne.couleur !== null ? (
        <label className="emplacement__titre">
          <span className="emplacement__titre-libelle">Short title</span>
          <input
            type="text"
            value={dossier.titre}
            maxLength={TITRE_LONGUEUR_MAX}
            aria-label={`Short title for “${ligne.libelle}”`}
            onChange={(evenement) => onRenommer(evenement.target.value)}
            onBlur={onFinirRenommage}
          />
        </label>
      ) : null}
    </li>
  )
}

function libelleDe(emplacement: Emplacement): string {
  const ligne = LIGNES.find((candidate) => candidate.emplacement === emplacement)
  return ligne === undefined ? emplacement : ligne.libelle
}

/**
 * Ce qui manque encore pour lancer le tri, ou `null` quand tout est prêt : sans
 * ce message, « Commencer le tri » resterait grisé sans rien expliquer.
 */
function decrireCeQuiManque(configuration: Configuration): string | null {
  if (configuration.source === null) {
    return 'The folder to sort is missing.'
  }
  if (compterDestinations(configuration) === 0) {
    return 'Choose at least one destination.'
  }
  if (configuration.poubelle === null) {
    return 'The Trash folder is missing.'
  }
  return null
}
