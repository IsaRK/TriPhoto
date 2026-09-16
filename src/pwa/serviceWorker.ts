/**
 * Enregistrement du service worker.
 *
 * `vite-plugin-pwa` sait injecter ce code tout seul, mais il est écrit ici à la
 * main : c'est une dizaine de lignes, et on voit ainsi exactement ce qui se passe
 * plutôt que d'avoir un script apparaître dans la page construite.
 *
 * Le fichier `sw.js` est produit par la construction ; il n'existe pas en
 * développement, d'où le garde sur `import.meta.env.PROD`. Sans lui, `npm run dev`
 * afficherait une erreur 404 à chaque démarrage.
 */
export function enregistrerServiceWorker() {
  if (!import.meta.env.PROD) return
  // Safari en navigation privée et quelques navigateurs d'entreprise n'exposent
  // pas l'API : l'application doit continuer à fonctionner sans être installable.
  if (!('serviceWorker' in navigator)) return

  // `BASE_URL` vaut « /TriPhoto/ » une fois publié sur GitHub Pages. Le service
  // worker doit être demandé à cette adresse, sinon son périmètre (scope) serait
  // la racine du domaine, que l'application ne contrôle pas.
  const adresse = `${import.meta.env.BASE_URL}sw.js`

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(adresse).catch((erreur) => {
      // Un échec n'empêche pas d'utiliser TriPhoto : on perd seulement le
      // fonctionnement hors ligne. On le signale en console sans déranger l'écran.
      console.warn('TriPhoto : service worker non enregistré.', erreur)
    })
  })
}
