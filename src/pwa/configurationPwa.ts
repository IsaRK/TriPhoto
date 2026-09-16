import type { ManifestOptions } from 'vite-plugin-pwa'
import type { VitePWAOptions } from 'vite-plugin-pwa'

/**
 * Le manifeste de l'application installable (« Ajouter à l'écran d'accueil »).
 *
 * Il vit dans un fichier à part, et non directement dans `vite.config.ts`, pour
 * qu'un test puisse vérifier ses invariants : une erreur ici ne casse rien à la
 * construction, elle se voit seulement le jour où l'installation sur le téléphone
 * démarre sur la mauvaise page ou affiche la mauvaise icône.
 */
export const MANIFESTE: Partial<ManifestOptions> = {
  name: 'TriPhoto',
  short_name: 'TriPhoto',
  description: 'Sort your OneDrive photos and videos with a swipe.',
  lang: 'en',
  // `standalone` retire la barre d'adresse : l'application lancée depuis l'écran
  // d'accueil ressemble à une application installée, et les gestes de swipe ne
  // risquent plus de déclencher le retour arrière du navigateur.
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f7f5f2',
  theme_color: '#405885',
  // Chemins **relatifs** au manifeste, et non absolus : sur GitHub Pages
  // l'application vit dans /TriPhoto/. Un `start_url` écrit « / » ouvrirait
  // https://isark.github.io, c'est-à-dire hors de l'application.
  start_url: '.',
  scope: '.',
  icons: [
    { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
    // Android rogne les icônes selon la forme du lanceur : celle-ci garde la
    // marque à l'intérieur de la zone sûre et remplit le fond jusqu'aux bords.
    { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

/**
 * Options du service worker, réunies ici pour la même raison que le manifeste :
 * ce sont des décisions qui ne se voient qu'en production, et qu'un test peut
 * relire.
 *
 * Deux principes les guident :
 *
 * 1. **Rien de Microsoft Graph n'est mis en cache.** Aucune règle de cache
 *    d'exécution n'est déclarée : le service worker ne connaît que les fichiers de
 *    l'application, et les appels à Graph partent toujours sur le réseau. Les
 *    garder afficherait des photos déjà déplacées, et laisserait des données
 *    privées dans le stockage du navigateur.
 *
 * 2. **Une nouvelle version publiée doit finir par arriver sur le téléphone.**
 *    C'est le rôle du mode « autoUpdate », qui pose `skipWaiting` et
 *    `clientsClaim` : le service worker fraîchement téléchargé s'active tout de
 *    suite au lieu d'attendre.
 *
 *    Le mode par défaut (« prompt ») a été essayé d'abord, en pensant qu'une
 *    version installée en arrière-plan s'activerait à la fermeture de
 *    l'application. C'était une erreur : une PWA posée sur l'écran d'accueil
 *    n'est pratiquement jamais fermée — elle reste dans les tâches récentes du
 *    téléphone — et le service worker en attente n'était donc jamais activé. On
 *    trie alors indéfiniment avec l'ancienne version, sans rien pour le
 *    signaler.
 *
 *    Ce que « autoUpdate » ne fait pas ici, c'est recharger la page : TriPhoto
 *    n'appelle pas le `registerSW` du plugin, qui s'en chargerait. Les fichiers
 *    déjà chargés continuent donc de tourner jusqu'à la fin du tri en cours, et
 *    la nouvelle version prend la main au lancement suivant. La pile
 *    d'annulation survit à un déploiement, ce qui était le vrai besoin.
 */
export const OPTIONS_PWA: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  // L'enregistrement est écrit à la main dans serviceWorker.ts, pour qu'il reste
  // lisible et testable plutôt que caché dans un script injecté dans la page.
  injectRegister: null,
  manifest: MANIFESTE,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
    // Une URL inconnue (/tri rechargé à la main) renvoie la page de l'application :
    // c'est le même rôle que le 404.html de GitHub Pages, mais hors ligne.
    navigateFallback: 'index.html',
  },
}
