import { Link } from 'react-router-dom'

/**
 * Écran de tri.
 * Lot 0 : simple coquille. L'affichage des médias et les gestes de swipe
 * arriveront dans les lots suivants.
 */
export default function EcranTri() {
  return (
    <main className="ecran">
      <header className="ecran__entete">
        <h1>Tri</h1>
        <p className="ecran__sous-titre">
          L'affichage des médias et les gestes de swipe seront disponibles dans
          un prochain lot.
        </p>
      </header>

      <Link className="bouton-principal" to="/">
        Retour à la configuration
      </Link>
    </main>
  )
}
