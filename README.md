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
- Scopes demandés : `User.Read`, `Files.ReadWrite` et `Files.ReadWrite.All`
  (ce dernier est nécessaire aux dossiers partagés, voir la section dédiée)
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
  `GET /me/drive?$select=id` (une seule fois, pour reconnaître notre propre drive),
  `GET /me/drive/root/children` puis `GET /drives/{driveId}/items/{id}/children`,
  avec `$select` explicite et suivi de la pagination (`@odata.nextLink`)
- Seuls les dossiers sont retenus ; les fichiers sont ignorés à ce stade
- Les raccourcis vers des **dossiers partagés** sont suivis jusqu'au drive
  d'origine (voir ci-dessous)
- Explorateur navigable (`src/config/ExplorateurDossiers.tsx`) : fil d'Ariane pour
  remonter, états chargement / dossier vide / erreur avec « Réessayer »
- Une fois connecté, l'écran d'accueil permet de parcourir son OneDrive et
  d'afficher le dossier retenu
- Le nombre indiqué à côté de chaque dossier est celui renvoyé par OneDrive : il
  compte les fichiers **et** les sous-dossiers

La racine du OneDrive ne peut pas être choisie comme dossier : il faut ouvrir un
dossier. L'attribution des dossiers aux directions de swipe et la sauvegarde de la
configuration arrivent au lot suivant.

## Les dossiers partagés

Cas visé : **la source est chez vous, les destinations sont des dossiers partagés**
par d'autres personnes (un album de famille, par exemple).

### Comment les rendre visibles

Un dossier partagé avec vous n'est pas dans votre OneDrive : il vit dans le drive
de la personne qui partage. Pour que TriPhoto le voie, ouvrez
[onedrive.live.com](https://onedrive.live.com) → **Partagés** → clic droit sur le
dossier → **Ajouter à mon OneDrive**. OneDrive crée alors un **raccourci** dans vos
fichiers.

TriPhoto suit ces raccourcis : ils apparaissent dans l'explorateur avec la mention
« partagé », et on navigue dedans comme dans n'importe quel dossier. Chaque dossier
transporte donc son `driveId`, celui de son propriétaire.

Cette approche a été préférée à `GET /me/drive/sharedWithMe`, qui listerait
directement les partages mais que Microsoft a **déprécié** : l'API cesse de
renvoyer des données en novembre 2026, sans remplacement annoncé pour les comptes
personnels. Les raccourcis, eux, sont de simples éléments de votre drive et ne
dépendent d'aucune API en sursis.

### Conséquence sur le tri : une copie, pas un déplacement

Microsoft Graph refuse de déplacer un fichier d'un drive vers un autre :
*« Items cannot be moved between Drives using this request »*. Le
`PATCH parentReference` utilisé pour un tri ordinaire ne franchit pas cette
frontière.

Quand la destination est dans un autre drive, TriPhoto procédera donc en deux
temps (Lot 5) :

1. `POST /drives/{driveId}/items/{id}/copy` vers le dossier de destination —
   l'opération est asynchrone, Graph renvoie un `202` et une URL à interroger
   jusqu'à la fin de la copie ;
2. l'original, qui est chez vous, est **déplacé vers votre dossier Poubelle** — et
   non supprimé.

Le principe « on ne supprime jamais rien » est préservé côté source : le fichier
d'origine reste chez vous, dans la Poubelle, et l'annulation le remet dans le
dossier source.

En revanche, **l'annulation ne défait pas la copie** : celle-ci reste dans l'album
de son propriétaire. L'enlever supposerait de supprimer un fichier chez quelqu'un
d'autre, ce que TriPhoto ne fera pas. Une annulation après un tri vers un dossier
partagé laisse donc un doublon à nettoyer à la main. Le prix à payer est aussi la
lenteur : une copie est bien plus longue qu'un déplacement.

Ce mécanisme impose le scope `Files.ReadWrite.All` en plus de `Files.ReadWrite`,
pour pouvoir écrire dans le drive de quelqu'un d'autre. Au prochain lancement,
Microsoft redemandera donc votre consentement.

## Limitations connues

- Un dossier partagé n'est visible qu'après un « Ajouter à mon OneDrive » ; il n'y
  a pas de découverte automatique des partages, faute d'API pérenne.
- Écrire dans un dossier partagé suppose que son propriétaire vous a donné le droit
  de **modification**, pas seulement de lecture.
- Annuler un tri vers un dossier partagé récupère bien votre fichier, mais laisse
  la copie chez son propriétaire.
- La racine du OneDrive n'est pas choisissable : il faut ouvrir un dossier.
