import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import DemarrageAuth from './auth/DemarrageAuth'
import { enregistrerServiceWorker } from './pwa/serviceWorker'
import './ui/theme.css'

const racine = document.getElementById('root')
if (!racine) {
  throw new Error("L'élément #root est introuvable dans index.html")
}

enregistrerServiceWorker()

createRoot(racine).render(
  <StrictMode>
    <DemarrageAuth>
      {/*
        `basename` : sur GitHub Pages l'application vit dans /TriPhoto/. Sans lui,
        React Router croirait que l'adresse /TriPhoto/tri est une route inconnue.
        Vite renseigne BASE_URL tout seul (« / » en développement).
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </DemarrageAuth>
  </StrictMode>,
)
