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
| Lot 3 | Écran de configuration : 4 destinations, poubelle, persistance | ✅ Terminé |
| Lot 4 | Listage des médias du dossier à trier (couche Graph) | ✅ Terminé |
| Lot 5 | Écran de tri en lecture seule : affichage des médias un par un | ✅ Terminé |
| Lots suivants | Gestes de swipe, déplacements Graph, annulation, PWA, README complet | ⏳ À venir |

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
dossier.

### Contenu du Lot 3

- Six emplacements à configurer (`src/config/configuration.ts`) : le dossier à
  trier, les quatre destinations de swipe et la poubelle
- Chaque destination porte la pastille de couleur de sa direction, prise dans
  `src/tri/directions.ts` — la même source de vérité que l'écran de tri
- Configuration persistée dans `localStorage` sous la clé `triphoto.configuration`,
  avec pour chaque dossier son `id`, son `driveId`, son nom et son chemin lisible
- Tout ce qui est relu du stockage est revalidé : un contenu corrompu, écrit par une
  version antérieure ou modifié à la main, est ignoré plutôt que de faire planter
  l'écran de tri
- Un même dossier ne peut pas occuper deux emplacements : il serait à la fois source
  et destination, et le tri tournerait en rond
- « Commencer le tri » reste désactivé tant qu'un dossier source et au moins une
  destination ne sont pas choisis
- Chaque emplacement peut être vidé individuellement

La poubelle est facultative pour démarrer le tri ; le bouton « Supprimer » de l'écran
de tri sera simplement indisponible tant qu'elle n'est pas choisie.

### Contenu du Lot 4

Uniquement la couche de lecture des médias (`src/graph/medias.ts`), sans interface :
l'écran de tri viendra au lot suivant.

- Listage du dossier à trier via `GET /drives/{driveId}/items/{id}/children`, en
  suivant `@odata.nextLink` jusqu'à la dernière page : un dossier de plusieurs
  milliers de photos est lu en entier
- Seuls les fichiers dont le `mimeType` commence par `image/` ou `video/` sont
  retenus ; les sous-dossiers et les documents sont écartés
- Tri par date de prise de vue croissante, la plus ancienne d'abord, en retenant
  la première date disponible dans cet ordre :

  | Ordre | Champ Graph | Pourquoi |
  | --- | --- | --- |
  | 1 | `photo.takenDateTime` | La date de l'appareil photo, la plus juste — mais absente des vidéos et des captures d'écran |
  | 2 | `fileSystemInfo.createdDateTime` | La date du fichier sur l'appareil d'origine, conservée par OneDrive à l'envoi |
  | 3 | `createdDateTime` | La date d'ajout dans OneDrive, en dernier recours |

  Sans la deuxième ligne, toutes les vidéos se regrouperaient au jour où l'appareil
  a été branché, et non au moment où elles ont été filmées.

- Les dates sont converties une seule fois en millisecondes au moment de la lecture :
  une date illisible vaut 0 plutôt que `NaN`, sinon un seul fichier au horodatage
  corrompu désordonnerait toute la liste
- Les miniatures sont demandées avec `$expand=thumbnails` — c'est une relation Graph
  et non un champ, elles ne viennent pas toutes seules

### Contenu du Lot 5

L'écran de tri, en **lecture seule** : on voit les médias, on ne les déplace pas encore.
Les gestes de swipe et les déplacements vers les dossiers de destination sont le sujet
des deux lots suivants. Ce lot sert surtout à confronter la couche Graph du Lot 4 à un
vrai OneDrive.

- Les médias du dossier à trier sont affichés **un par un**, en **plein écran**, du plus
  ancien au plus récent, avec la progression (`12 / 340`) et la date de prise de vue
- La photo est affichée entière (jamais rognée) sur un fond sombre : rogner ferait
  décider sur un cadrage que le fichier n'a pas
- Les **quatre destinations** sont posées par-dessus, au milieu de chaque bord, avec leur
  couleur, leur forme directionnelle et leur titre court
- Les **quatre boutons des coins** : retour à l'accueil (haut gauche), annuler (haut
  droite), poubelle (bas gauche), passer (bas droite). Les trois premiers portent
  leur mot sous l'icône ; seule la poubelle reste une icône seule, universelle. Ils
  ne répondent qu'au clic : aucun geste de swipe ne leur est associé.
- À ce stade, seuls **retour** et **passer** agissent. Poubelle, annuler et les quatre
  destinations demandent de déplacer des fichiers, ce qui viendra au Lot 7.
- Le dossier **Poubelle est désormais obligatoire** pour lancer le tri : sans lui, le
  bouton Supprimer n'aurait nulle part où envoyer les médias
- Pour une photo, c'est la **miniature** Graph qui est affichée et non le fichier
  d'origine : une photo de téléphone pèse plusieurs mégaoctets, la miniature quelques
  centaines de kilooctets. Le fichier complet ne sert que si OneDrive n'a pas produit
  de miniature.
- Pour une vidéo, un lecteur `<video>` avec ses contrôles, sans lecture automatique
- Le média **suivant** est demandé au navigateur à l'avance, hors de l'écran, pour que
  le passage au suivant soit instantané. Pour une vidéo on ne précharge que les
  métadonnées : télécharger le fichier entier coûterait cher en données mobiles.
- Les erreurs sont distinguées : une session expirée propose de se reconnecter, une
  erreur réseau propose de réessayer

### Titres courts et formes directionnelles

Retouche d'interface de l'écran de configuration, sans nouvelle fonctionnalité Graph :

- Chaque destination porte un **titre court** (10 caractères au maximum), saisi juste
  sous le dossier choisi. Il est repris tel quel pendant le tri, pour se rappeler quelle
  direction mène à quel dossier sans relire un chemin entier.
- Le titre est proposé d'office à partir du nom du dossier. Il n'est ramené à cette
  valeur par défaut que si on quitte le champ en l'ayant laissé vide — pendant la frappe,
  le champ peut rester vide, sinon il serait impossible de tout effacer pour retaper.
- Une configuration enregistrée avant l'arrivée des titres n'en a pas : elle est
  **complétée** à la relecture plutôt que rejetée, pour ne pas faire perdre ses dossiers.
- Les pastilles de couleur ne sont plus des ronds mais des **formes qui pointent vers
  leur direction**, sur l'écran de configuration comme sur la boussole d'accueil.
- Le titre « TriPhoto » est remplacé par un logo (`src/ui/Logo.tsx`) : un appareil photo
  entouré des quatre flèches de direction. Les couleurs y sont lues dans
  `src/tri/directions.ts`, jamais réécrites en dur, pour que le logo suive la palette.

## Les dossiers partagés

Cas visé : **la source est chez vous, les destinations sont des dossiers partagés**
par d'autres personnes (un album de famille, par exemple).

### Comment les rendre visibles

D'abord, une distinction qui évite une manipulation inutile :

- **Un dossier que vous possédez et que vous partagez avec d'autres** est dans
  votre OneDrive. Il apparaît déjà dans TriPhoto, il n'y a rien à faire.
- **Un dossier que quelqu'un d'autre partage avec vous** vit dans *son* OneDrive.
  C'est celui-là qui demande l'étape ci-dessous.

Sur [onedrive.live.com](https://onedrive.live.com), dans le menu de gauche :
**Partagé** → **Partagé avec vous**. Sélectionnez le dossier, puis
**Ajouter un raccourci à Mes fichiers** — soit par le bouton de la barre du haut,
soit par un clic droit. Le dossier doit être partagé avec le droit
« Peut modifier » ; en lecture seule, l'option n'apparaît pas et TriPhoto ne
pourrait de toute façon rien y déposer.

OneDrive crée alors un **raccourci** dans vos fichiers. (L'ancien libellé
« Ajouter à mon OneDrive » désigne la même chose.)

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

- Un dossier partagé par quelqu'un d'autre n'est visible qu'après un « Ajouter un
  raccourci à Mes fichiers » ; il n'y a pas de découverte automatique des partages,
  faute d'API pérenne.
- Écrire dans un dossier partagé suppose que son propriétaire vous a donné le droit
  de **modification**, pas seulement de lecture.
- Annuler un tri vers un dossier partagé récupère bien votre fichier, mais laisse
  la copie chez son propriétaire.
- La racine du OneDrive n'est pas choisissable : il faut ouvrir un dossier.
- Les URL de téléchargement renvoyées par Graph expirent au bout d'environ une heure,
  et l'écran de tri ne les redemande pas encore : sur une session très longue, les
  médias finissent par ne plus s'afficher. Recharger la page suffit à repartir.
- La liste des médias est lue une seule fois à l'entrée dans l'écran de tri. Les
  photos ajoutées au dossier pendant le tri n'apparaissent qu'au rechargement.
- OneDrive ne produit pas toujours la miniature de tous les fichiers d'une page.
  Les médias concernés sont conservés avec une miniature absente, à charge de
  l'écran de tri de se rabattre sur le fichier lui-même.