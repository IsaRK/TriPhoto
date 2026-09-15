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
      <header className="ecran__entete">
        <h1>TriPhoto</h1>
        <p className="ecran__sous-titre">
          Trier ses photos et vidéos OneDrive d'un simple geste.
        </p>
      </header>

      <section className="carte">
        <h2>Configuration</h2>
        <p className="ecran__sous-titre">
          Le choix du dossier source et des dossiers de destination sera
          disponible dans un prochain lot.
        </p>
      </section>

      <section className="carte">
        <h2>Directions de swipe</h2>
        <ul className="directions">
          {DIRECTIONS.map((info) => (
            <li key={info.direction} className="direction">
              <span
                className="direction__pastille"
                style={{ backgroundColor: info.couleur }}
                aria-hidden="true"
              />
              <span>{info.libelle}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link className="bouton-principal" to="/tri">
        Commencer le tri
      </Link>
    </main>
  )
}
