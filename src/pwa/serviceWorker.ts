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

  surveillerLesMisesAJour()

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(adresse).catch((erreur) => {
      // Un échec n'empêche pas d'utiliser TriPhoto : on perd seulement le
      // fonctionnement hors ligne. On le signale en console sans déranger l'écran.
      console.warn('TriPhoto : service worker non enregistré.', erreur)
    })
  })
}

/**
 * Recharge la page quand une nouvelle version prend la main.
 *
 * Sans cela, une version publiée ne se voit qu'au lancement **suivant** : le
 * service worker s'active bien, mais la page en cours tourne toujours avec les
 * fichiers qu'elle a reçus au démarrage. Sur un téléphone, où l'application
 * installée reste des jours dans les tâches récentes, cela revient à ne jamais
 * voir les mises à jour.
 */
function surveillerLesMisesAJour() {
  // Au tout premier chargement, aucun service worker ne contrôle encore la page :
  // il va en prendre le contrôle, mais ce n'est pas une mise à jour et recharger
  // n'aurait aucun sens.
  const versionPrecedenteActive = navigator.serviceWorker.controller !== null
  let dejaRecharge = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!versionPrecedenteActive) return
    // Garde-fou contre la boucle : un rechargement ne doit jamais en déclencher
    // un autre.
    if (dejaRecharge) return
    // Jamais pendant un tri : le média affiché et la pile d'annulation vivent en
    // mémoire, un rechargement les perdrait. La nouvelle version attendra le
    // retour à l'écran de configuration.
    if (unTriEstEnCours()) return

    dejaRecharge = true
    window.location.reload()
  })
}

function unTriEstEnCours() {
  return window.location.pathname.endsWith('/tri')
}
