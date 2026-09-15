import { Link } from 'react-router-dom'

/**
 * Écran de tri.
 * Lot 0 : simple coquille. L'affichage des médias et les gestes de swipe
 * arriveront dans les lots suivants.
 */
export default function EcranTri() {
  return (
    <main className="ecran">
      <header>
        <h1 className="titre">Tri</h1>
      </header>

      <div className="contenu">
        <p className="note">
          Les médias et les gestes de swipe arriveront dans un prochain lot.
        </p>
      </div>

      <Link className="action action--discrete" to="/">
        Retour à la configuration
      </Link>
    </main>
  )
}
