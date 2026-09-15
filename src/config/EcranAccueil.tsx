import { useMsal } from '@azure/msal-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CompteMicrosoft from '../auth/CompteMicrosoft'
import { DIRECTIONS } from '../tri/directions'
import type { Configuration, DossierConfigure, Emplacement } from './configuration'
import {
  compterDestinations,
  definirDossier,
  ecrireConfiguration,
  effacerConfiguration,
  emplacementDejaUtilise,
  estConfigurationVide,
  lireConfiguration,
  peutCommencerLeTri,
  retirerDossier,
  CONFIGURATION_VIDE,
} from './configuration'
import ExplorateurDossiers from './ExplorateurDossiers'

type LigneEmplacement = {
  emplacement: Emplacement
  libelle: string
  /** `null` pour les emplacements qui ne correspondent pas à une direction. */
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

  const enregistrer = (nouvelle: Configuration) => {
    setConfiguration(nouvelle)
    setAvertissement(ecrireConfiguration(nouvelle) ? null : MESSAGE_STOCKAGE_REFUSE)
  }

  const ouvrirExplorateur = (emplacement: Emplacement) => {
    setAvertissement(null)
    setEmplacementEnCours(emplacement)
  }

  const choisirDossier = (dossier: DossierConfigure) => {
    if (emplacementEnCours === null) {
      return
    }
    const occupant = emplacementDejaUtilise(configuration, emplacementEnCours, dossier)
    if (occupant !== null) {
      setAvertissement(
        `« ${dossier.nom} » est déjà utilisé pour « ${libelleDe(occupant)} ». Choisissez un autre dossier.`,
      )
      return
    }
    enregistrer(definirDossier(configuration, emplacementEnCours, dossier))
    setEmplacementEnCours(null)
  }

  const retirer = (emplacement: Emplacement) =>
    enregistrer(retirerDossier(configuration, emplacement))

  const toutEffacer = () => {
    setConfiguration(CONFIGURATION_VIDE)
    effacerConfiguration()
    setAvertissement(null)
  }

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
      <header>
        <h1 className="titre">TriPhoto</h1>
        <p className="accroche">Trier ses photos et vidéos OneDrive d'un simple geste.</p>
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
              />
            ))}
          </ul>
        ) : (
          <>
            <ul className="boussole">
              {DIRECTIONS.map((info) => (
                <li key={info.direction} className={`direction direction--${info.direction}`}>
                  <span
                    className="direction__pastille"
                    style={{ backgroundColor: info.couleur }}
                    aria-hidden="true"
                  />
                  <span className="direction__libelle">{info.libelle}</span>
                </li>
              ))}
            </ul>

            <p className="note">
              Chaque couleur correspond à un dossier de destination. Connectez-vous pour choisir
              vos dossiers.
            </p>
          </>
        )}
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
            <p className="note">{decrireAvancement(configuration)}</p>
            {estConfigurationVide(configuration) ? null : (
              <button type="button" className="action action--discrete" onClick={toutEffacer}>
                Effacer la configuration
              </button>
            )}
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
}: {
  ligne: LigneEmplacement
  dossier: DossierConfigure | null
  onOuvrir: () => void
  onRetirer: () => void
}) {
  return (
    <li className="emplacement">
      <button type="button" className="emplacement__choix" onClick={onOuvrir}>
        <span
          className={ligne.couleur === null ? 'emplacement__puce' : 'emplacement__pastille'}
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
    </li>
  )
}

function libelleDe(emplacement: Emplacement): string {
  const ligne = LIGNES.find((candidate) => candidate.emplacement === emplacement)
  return ligne === undefined ? emplacement : ligne.libelle
}

function decrireAvancement(configuration: Configuration): string {
  if (configuration.source === null) {
    return 'Choisissez d’abord le dossier à trier.'
  }
  const destinations = compterDestinations(configuration)
  if (destinations === 0) {
    return 'Choisissez au moins une destination.'
  }
  const accord = destinations === 1 ? 'destination choisie' : 'destinations choisies'
  const poubelle = configuration.poubelle === null ? ' La poubelle reste à choisir.' : ''
  return `${destinations} ${accord} sur 4.${poubelle}`
}
