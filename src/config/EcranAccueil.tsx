import { useMsal } from '@azure/msal-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import CompteMicrosoft from '../auth/CompteMicrosoft'
import { DIRECTIONS } from '../tri/directions'
import type { DossierChoisi } from './ExplorateurDossiers'
import ExplorateurDossiers from './ExplorateurDossiers'

/**
 * Écran d'accueil / configuration.
 * Lot 2 : parcourir ses dossiers OneDrive. L'attribution des dossiers aux
 * directions de swipe et la sauvegarde de la configuration arriveront ensuite.
 */
export default function EcranAccueil() {
  const { accounts } = useMsal()
  const estConnecte = accounts.length > 0
  const [dossierChoisi, setDossierChoisi] = useState<DossierChoisi | null>(null)

  return (
    <main className="ecran">
      <header>
        <h1 className="titre">TriPhoto</h1>
        <p className="accroche">Trier ses photos et vidéos OneDrive d'un simple geste.</p>
      </header>

      <div className="contenu">
        {estConnecte ? (
          <>
            <ExplorateurDossiers onChoisir={setDossierChoisi} />
            {dossierChoisi ? (
              <p className="note">
                Dossier choisi : <strong>{dossierChoisi.chemin}</strong>
              </p>
            ) : null}
          </>
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
              Chaque couleur correspond à un dossier de destination. Connectez-vous pour
              choisir vos dossiers.
            </p>
          </>
        )}
      </div>

      <div className="pile">
        <CompteMicrosoft />
        <Link className="action action--discrete" to="/tri">
          Commencer le tri
        </Link>
      </div>
    </main>
  )
}
