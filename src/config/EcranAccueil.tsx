import { Link } from 'react-router-dom'
import { DIRECTIONS } from '../tri/directions'

/**
 * Écran d'accueil / configuration.
 * Lot 0 : simple coquille. La connexion Microsoft et le choix des dossiers
 * OneDrive arriveront dans les lots suivants.
 */
export default function EcranAccueil() {
  return (
    <main className="ecran">
      <header>
        <h1 className="titre">TriPhoto</h1>
        <p className="accroche">Trier ses photos et vidéos OneDrive d'un simple geste.</p>
      </header>

      <div className="contenu">
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
          Chaque couleur correspond à un dossier de destination. Le choix des dossiers
          arrivera dans un prochain lot.
        </p>
      </div>

      <Link className="action" to="/tri">
        Commencer le tri
      </Link>
    </main>
  )
}
