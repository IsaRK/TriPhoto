# TriPhoto

Trier rapidement les photos et vidéos d'un dossier OneDrive, à la manière de Tinder :
chaque média est envoyé vers l'un des dossiers de destination d'un simple geste.

> Le README complet (choix techniques, création de l'app registration Entra, installation
> de la PWA sur téléphone, structure du projet) sera rédigé au Lot 10. Ce document se
> limite pour l'instant à l'avancement et au démarrage en développement.

## Démarrage en développement

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # tests unitaires (Vitest)
npm run build    # vérification des types + build de production
```

Copier `.env.example` vers `.env.local` et y renseigner `VITE_MSAL_CLIENT_ID`.
Sans cette variable, l'application affiche un écran « Configuration incomplète »
qui rappelle la marche à suivre.

## Créer l'app registration Entra

L'application n'a pas de backend : elle se connecte à Microsoft depuis le navigateur.
Il faut donc déclarer une application dans Entra (ex-Azure AD) et récupérer son Client ID.

1. Aller sur [portal.azure.com](https://portal.azure.com) et se connecter avec le compte
   Microsoft **personnel** qui possède les photos.
2. Chercher **« App registrations »** dans la barre de recherche du portail, puis cliquer
   sur **New registration**.
3. **Name** : `TriPhoto` (ce nom n'est visible que par vous).
4. **Supported account types** : choisir
   **« Personal Microsoft accounts only »**.
5. **Redirect URI** : choisir la plateforme **« Single-page application (SPA) »** dans la
   liste déroulante — surtout pas « Web » — et saisir `http://localhost:5173`.
6. Cliquer sur **Register**.
7. Sur la page **Overview** de l'application, copier la valeur
   **Application (client) ID** (un identifiant de la forme `11111111-2222-3333-4444-555555555555`).
8. Créer un fichier `.env.local` à la racine du projet contenant :
   `VITE_MSAL_CLIENT_ID=<l'identifiant copié>`
9. Relancer `npm run dev`.

Aucun secret client (« client secret ») n'est nécessaire, et il ne faut surtout pas en
créer : le code s'exécute entièrement dans le navigateur, où rien ne peut rester secret.
C'est aussi pour cela que la plateforme doit être « SPA » et non « Web ».
Lors du déploiement, ajouter l'URL de production dans la même section
**Authentication → Single-page application** de l'app registration.

## État d'avancement

| Lot | Périmètre | Statut |
| --- | --- | --- |
| Lot 0 | Fondations : Vite + React + TypeScript, thème et palette, routage, Vitest | ✅ Terminé |
| Lot 1 | Authentification Microsoft (MSAL, comptes personnels) | ✅ Terminé |
| Lot 2 | Explorateur de dossiers OneDrive (couche Graph de lecture) | ✅ Terminé |
| Lots suivants | Écran de configuration (4 destinations + poubelle), listage des médias, gestes de swipe, déplacements Graph, annulation, PWA, README complet | ⏳ À venir |

### Contenu du Lot 0

- Coquille Vite + React + TypeScript en `strict: true`
- Thème CSS avec la palette (orange `#FFA530`, vert d'eau `#50ACA2`, bleu `#405885`,
  rose `#E0748B`, fond `#F7F5F2`) et layout mobile plein écran (`100dvh`, `viewport-fit=cover`)
- Table des directions de swipe (`src/tri/directions.ts`), source de vérité unique des
  couleurs associées à chaque direction : gauche → bleu, droite → orange,
  haut → vert d'eau, bas → rose
- Routage `react-router-dom` : `/` (accueil / configuration) et `/tri`
- Tests Vitest + Testing Library (routage et cohérence des directions)

### Contenu du Lot 1

- Connexion et déconnexion avec un compte Microsoft **personnel**
  (authority `https://login.microsoftonline.com/consumers`)
- Scopes demandés : `User.Read` et `Files.ReadWrite`
- Flux par **redirection** (et non popup), plus fiable sur navigateur mobile
- Appel Microsoft Graph `GET /me` en REST, qui affiche le nom du compte connecté et
  prouve que le jeton d'accès fonctionne
- Message explicite si `VITE_MSAL_CLIENT_ID` est absent
- Une seule instance MSAL pour toute la page, et aucun clignotement entre
  « déconnecté » et « connecté » au démarrage
- Session expirée : l'app propose une reconnexion manuelle plutôt que de rediriger
  toute seule (une cause persistante enchaînerait sinon les redirections)

Le choix des dossiers OneDrive et les gestes de swipe restent à venir.

### Contenu du Lot 2

- Lecture des dossiers OneDrive en REST brut (`src/graph/dossiers.ts`) :
  `GET /me/drive/root/children` et `GET /me/drive/items/{id}/children`, avec
  `$select` explicite et suivi de la pagination (`@odata.nextLink`)
- Seuls les dossiers sont retenus ; les fichiers sont ignorés à ce stade
- Explorateur navigable (`src/config/ExplorateurDossiers.tsx`) : fil d'Ariane pour
  remonter, états chargement / dossier vide / erreur avec « Réessayer »
- Une fois connecté, l'écran d'accueil permet de parcourir son OneDrive et
  d'afficher le dossier retenu
- Le nombre indiqué à côté de chaque dossier est celui renvoyé par OneDrive : il
  compte les fichiers **et** les sous-dossiers

La racine du OneDrive ne peut pas être choisie comme dossier : il faut ouvrir un
dossier. L'attribution des dossiers aux directions de swipe et la sauvegarde de la
configuration arrivent au lot suivant.

## Limitations connues

### Les dossiers partagés ne sont pas accessibles

TriPhoto ne parcourt que **votre propre OneDrive**. Les dossiers que d'autres
personnes ont partagés avec vous (« Partagés avec moi ») ne sont pas proposés.

Ce n'est pas la lecture qui pose problème — `GET /me/drive/sharedWithMe` la
permettrait — mais le tri lui-même. Microsoft Graph refuse de déplacer un fichier
d'un OneDrive vers un autre : *« Items cannot be moved between Drives using this
request »*. Il faudrait alors copier le média puis supprimer l'original, ce qui
contredit deux principes du produit : déplacer plutôt que copier, et ne jamais
supprimer réellement un fichier. Qui plus est, la suppression porterait sur le
fichier de quelqu'un d'autre, et l'annulation deviendrait beaucoup plus fragile.

À noter enfin que `sharedWithMe` est annoncé comme déprécié pour les comptes
Microsoft personnels.

Un cas fonctionnerait proprement : une source et des destinations toutes situées
dans un **même** drive partagé, puisque le déplacement resterait interne à ce
drive. Cela demanderait de transporter un `driveId` dans toute la configuration et
d'élargir les permissions à `Files.ReadWrite.All`. La complexité n'a pas paru
justifiée pour un usage qui reste marginal ; à rouvrir si le besoin se confirme.
