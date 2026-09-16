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
  { emplacement: 'source', libelle: 'Dossier à trier', couleur: null },
  ...DIRECTIONS.map((info) => ({
    emplacement: info.direction,
    libelle: info.libelle,
    couleur: info.couleur,
  })),
  { emplacement: 'poubelle', libelle: 'Poubelle', couleur: null },
]

const MESSAGE_STOCKAGE_REFUSE =
  'Votre navigateur refuse d’enregistrer la configuration : elle sera perdue au ' +
  'prochain rechargement. C’est le cas en navigation privée, ou si le stockage du ' +
  'site est bloqué.'

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

  const choisirDossier = (choisi: DossierChoisi) => {
    if (emplacementEnCours === null) {
      return
    }
    const occupant = emplacementDejaUtilise(configuration, emplacementEnCours, choisi)
    if (occupant !== null) {
      setAvertissement(
        `« ${choisi.nom} » est déjà utilisé pour « ${libelleDe(occupant)} ». Choisissez un autre dossier.`,
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
        <header>
          <h1 className="titre">{libelleDe(emplacementEnCours)}</h1>
          <p className="accroche">Ouvrez un dossier, puis validez-le.</p>
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
          Annuler
        </button>
      </main>
    )
  }

  return (
    <main className="ecran">
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
              Commencer le tri
            </button>
            {manque === null ? null : <p className="note">{manque}</p>}
          </>
        ) : null}
        <CompteMicrosoft />
      </div>
    </main>
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
              {dossier === null ? 'Aucun dossier' : dossier.chemin}
            </span>
          </span>
        </button>
        {dossier === null ? null : (
          <button
            type="button"
            className="emplacement__retirer"
            onClick={onRetirer}
            aria-label={`Retirer le dossier de « ${ligne.libelle} »`}
          >
            ✕
          </button>
        )}
      </div>

      {dossier !== null && ligne.couleur !== null ? (
        <label className="emplacement__titre">
          <span className="emplacement__titre-libelle">Titre court</span>
          <input
            type="text"
            value={dossier.titre}
            maxLength={TITRE_LONGUEUR_MAX}
            aria-label={`Titre court de « ${ligne.libelle} »`}
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
    return 'Il manque le dossier à trier.'
  }
  if (compterDestinations(configuration) === 0) {
    return 'Choisissez au moins une destination.'
  }
  if (configuration.poubelle === null) {
    return 'Il manque le dossier Poubelle.'
  }
  return null
}
