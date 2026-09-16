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

## Voir le rendu sur téléphone

TriPhoto est faite pour être utilisée au doigt, sur un téléphone. Deux façons de le
vérifier, de la plus rapide à la plus fidèle.

### Coup d'œil rapide : le mode appareil des DevTools

Dans Edge ou Chrome, sur `http://localhost:5173`, appuyer sur `F12` puis
`Ctrl+Shift+M`. Une liste déroulante en haut permet de choisir un modèle
(iPhone 14 Pro, Pixel 7…) ou de saisir des dimensions libres.

C'est parfait pour vérifier une mise en page, et le navigateur traduit même la souris en
événements tactiles, ce qui suffit à essayer les gestes de swipe. En revanche il ne
reproduit ni la vraie densité de pixels, ni l'inertie du doigt, ni la barre d'adresse qui
se rétracte au défilement.

### Vérification réelle : son propre téléphone

```bash
npm run dev:mobile
```

Vite affiche alors une ligne `Network:` du genre `https://192.168.1.12:5173/` : c'est
l'adresse à ouvrir dans le navigateur du téléphone, **connecté au même Wi-Fi** que
l'ordinateur.

Trois points à connaître :

- **C'est du HTTPS, et c'est obligatoire.** Entra n'accepte une URI de redirection en
  clair (`http://`) que pour `localhost`. Un téléphone qui arriverait sur
  `http://192.168.x.x:5173` se verrait refuser la connexion Microsoft. D'où le mode
  `dev:mobile`, qui active un certificat auto-signé.
- **Le téléphone affichera un avertissement de sécurité** (« connexion non privée ») :
  le certificat est fabriqué à la volée par le poste de développement, personne ne l'a
  signé. Il faut passer outre une fois — c'est sans danger sur son propre réseau.
- **Il faut déclarer cette adresse dans Entra** : *App registrations → TriPhoto →
  Authentication → Single-page application → Add URI*, avec exactement
  `https://192.168.1.12:5173` (votre IP, sans barre oblique finale). Cette IP est
  attribuée par la box et peut changer ; si la connexion échoue après un redémarrage,
  c'est la première chose à revérifier.

Si le téléphone n'arrive pas à joindre l'adresse, c'est en général le pare-feu Windows
qui bloque le port 5173 en entrée : autoriser Node.js sur les **réseaux privés** lors de
la fenêtre qui s'affiche au premier lancement, ou ajouter une règle entrante pour ce port.

Le code, lui, n'a rien de particulier à faire : MSAL utilise `window.location.origin`
comme URI de redirection, donc il suit automatiquement l'adresse par laquelle on est
arrivé.

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

## Mettre l'application en ligne

Tant que l'application n'est pas hébergée, elle n'existe que pendant que
`npm run dev:mobile` tourne, sur le même Wi-Fi, avec un avertissement de certificat
et une adresse IP qui change. Pour s'en servir vraiment, il faut la publier.

Ce sera forcément une adresse en **`https://`**, jamais en `http://` : Entra refuse une
URI de redirection en clair ailleurs que sur `localhost`, et une PWA installable exige un
service worker, qui n'existe qu'en contexte sécurisé. Sans HTTPS, pas de « Ajouter à
l'écran d'accueil ».

**Publier TriPhoto ne divulgue rien.** Il n'y a pas de backend, pas de secret — le Client
ID voyage de toute façon en clair dans chaque URL de connexion Microsoft — et surtout
**les photos ne transitent jamais par l'hébergeur** : le navigateur parle directement à
Microsoft Graph. Quelqu'un qui tomberait sur l'adresse verrait l'écran de connexion et
trierait son propre OneDrive, pas le vôtre.

### Pourquoi Azure Static Web Apps

Le dépôt est **privé**, ce qui écarte GitHub Pages (qui demanderait un abonnement payant
ou de rendre le code public). Parmi les hébergeurs gratuits restants, Azure Static Web
Apps a deux avantages ici : c'est le même compte Microsoft que celui qui sert déjà pour
l'app registration Entra, et le plan gratuit accepte les dépôts privés.

L'application utilise `BrowserRouter`, donc l'adresse `/tri` est une vraie URL. Un
hébergeur statique naïf répondrait 404 si l'on rechargeait la page à cet endroit. C'est le
rôle de `public/staticwebapp.config.json` : il demande à Azure de renvoyer `index.html`
pour toute URL qui ne correspond pas à un fichier, à charge pour React Router de faire le
reste. Le fichier est dans `public/` et non à la racine parce que Vite recopie ce dossier
tel quel dans `dist/`, où Azure va le chercher.

### La marche à suivre

1. Sur [portal.azure.com](https://portal.azure.com), chercher **Static Web Apps**, puis
   **Create**.
2. **Plan type** : **Free**. **Source de déploiement** : choisir **Other**, et surtout
   pas « GitHub ». Si l'on choisit GitHub, Azure écrit lui-même un second fichier de
   workflow, qui fera doublon avec `.github/workflows/deploiement.yml`.
3. Une fois la ressource créée, ouvrir **Overview → Manage deployment token** et copier
   le jeton.
4. Sur GitHub, dans **Settings → Secrets and variables → Actions** du dépôt :
   - onglet **Secrets**, bouton **New repository secret** :
     nom `AZURE_STATIC_WEB_APPS_API_TOKEN`, valeur = le jeton copié ;
   - onglet **Variables**, bouton **New repository variable** :
     nom `VITE_MSAL_CLIENT_ID`, valeur = le Client ID de l'app registration.
     C'est une variable et non un secret, parce que ce n'est pas un secret.
5. Azure attribue une adresse du genre `https://joli-nom-1234.azurestaticapps.net`.
   L'ajouter dans l'app registration Entra, sous **Authentication → Single-page
   application → Add URI**, sans barre oblique finale.
6. Pousser sur `main` : le workflow vérifie les types, lance les tests, construit
   l'application et la publie. L'onglet **Actions** du dépôt montre le déroulement.

Le déploiement n'a volontairement **pas** lieu sur les pull requests. Azure fabriquerait
une URL de préversion différente à chaque fois, et chacune devrait être déclarée une par
une dans Entra : la préversion serait donc une application sur laquelle il est impossible
de se connecter, ce qui induirait plus en erreur qu'autre chose.

## État d'avancement

| Lot | Périmètre | Statut |
| --- | --- | --- |
| Lot 0 | Fondations : Vite + React + TypeScript, thème et palette, routage, Vitest | ✅ Terminé |
| Lot 1 | Authentification Microsoft (MSAL, comptes personnels) | ✅ Terminé |
| Lot 2 | Explorateur de dossiers OneDrive (couche Graph de lecture) | ✅ Terminé |
| Lot 3 | Écran de configuration : 4 destinations, poubelle, persistance | ✅ Terminé |
| Lot 4 | Listage des médias du dossier à trier (couche Graph) | ✅ Terminé |
| Lot 5 | Écran de tri en lecture seule : affichage des médias un par un | ✅ Terminé |
| Lot 6 | Gestes de swipe au doigt, raccourcis clavier, overlay de destination | ✅ Terminé |
| Lot 7 | Mise en ligne : Azure Static Web Apps, workflow GitHub Actions | ✅ Terminé |
| Lots suivants | PWA (manifest, service worker), README complet | ⏳ À venir |

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
- Appel Microsoft Graph `GET /me` en REST, qui affiche le nom **et l'adresse** du compte
  connecté et prouve que le jeton d'accès fonctionne. Les champs sont demandés
  explicitement (`$select=displayName,givenName,mail,userPrincipalName`) car sur un
  compte Microsoft personnel `mail` est souvent vide alors que `userPrincipalName`
  porte l'adresse. Si Graph n'en renvoie aucune, on se rabat sur le `username` du
  compte MSAL, qui est exactement l'adresse saisie à la connexion.
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

L'écran de tri. On voit les médias un par un, et les trois boutons qui ne dépendent pas
d'une direction agissent déjà : `Delete` envoie le média à la poubelle, `Cancel` le
ramène, `Skip` passe au suivant. Les **gestes de swipe** vers les quatre destinations sont
le sujet du Lot 6, décrit plus bas.

- Les médias du dossier à trier sont affichés **un par un**, en **plein écran**, du plus
  ancien au plus récent, avec la progression (`12 / 340`) et la date de prise de vue
- La photo est affichée entière (jamais rognée) sur un fond sombre : rogner ferait
  décider sur un cadrage que le fichier n'a pas
- Les **quatre destinations** sont posées par-dessus, au milieu de chaque bord, avec leur
  couleur et leur titre court. Ce sont de petites pastilles bien rondes, aussi compactes que
  leur titre le permet, prolongées d'une **pointe** du côté vers lequel on envoie la photo.
  La flèche découpée d'une première version imposait une pointe longue et une hauteur fixe
  qui mangeaient l'image.
- Les **quatre boutons des coins** : `Home` (haut gauche), `Cancel` (haut droite),
  `Delete` (bas gauche), `Skip` (bas droite). Ils portent leur mot seul, sans
  pictogramme, et ne répondent qu'au clic : aucun geste de swipe ne leur est associé.
  Ce sont les seuls libellés en anglais de l'application, à la demande expresse de
  l'utilisatrice : ces quatre mots lui sont plus familiers que leur traduction.
- `Home`, `Delete` et `Skip` sont **toujours actifs**. Seul `Cancel` peut être inactif :
  il n'a rien à annuler tant qu'aucun média n'a été déplacé. Il est alors
  estompé, ce qui est ici une information juste et non un défaut d'affichage, puisque les
  trois autres ne le sont jamais.
- **Supprimer ne supprime pas** : `Delete` déplace le média vers le dossier Poubelle
  configuré, par un `PATCH /drives/{driveId}/items/{itemId}` avec
  `{ "parentReference": { "id": "<idPoubelle>" } }`.
- **Annuler** refait le même appel en sens inverse, vers le dossier à trier, et **réaffiche la
  photo récupérée**. `Cancel` défait **uniquement le dernier déplacement** : on ne remonte pas
  aux précédents, qui sont acquis. Une fois l'annulation faite, le bouton
  redevient inactif jusqu'au prochain déplacement.
- `Cancel` reste proposé sur l'écran « Tri terminé » quand une suppression est encore
  rattrapable : sans cela, le dernier média envoyé à la poubelle ne serait plus récupérable
  depuis TriPhoto.
- Un déplacement qui échoue **ne perd rien** : la liste et le média récupérable restent en
  place, un message s'affiche et le geste peut être refait.
- Un dossier situé sur **un autre OneDrive** (dossier partagé) est refusé avec un message
  clair : `PATCH parentReference` ne traverse pas les drives. Ce cas relève d'une copie,
  qui reste hors du périmètre.
- Les **quatre destinations** ne sont pas encore actives à ce stade : les gestes de swipe
  viennent au Lot 6.
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

### Contenu du Lot 6

Le geste de swipe, qui est la raison d'être de l'application : on pousse la photo vers le
dossier où elle doit aller, et elle y va.

- **On fait glisser la photo au doigt.** La carte suit le doigt et s'incline légèrement
  dans le sens du mouvement. L'inclinaison est **bornée à 12°** : au-delà, la photo devient
  pénible à regarder alors qu'on est précisément en train de décider de son sort.
- La direction retenue est celle de l'**axe dominant** : on compare l'écart horizontal et
  l'écart vertical, et le plus grand l'emporte. Un geste un peu de travers part donc là où
  on l'a voulu, et non dans un coin.
- Le geste ne déclenche rien tant qu'il n'a pas dépassé **90 pixels**. En dessous, la carte
  revient à sa place. C'est ce qui permet de **changer d'avis en cours de geste**, et
  d'éviter qu'un effleurement pendant le défilement n'expédie une photo.
- Une fois le seuil franchi, un **voile de la couleur de la direction** recouvre la photo et
  le **titre court du dossier** s'affiche au centre, dans une pastille de cette même
  couleur. Le message est : « si tu lâches maintenant, la photo part là ». Tant que le
  voile n'est pas là, le geste peut encore être abandonné en ramenant le doigt.
- Swiper vers une direction **à laquelle aucun dossier n'est associé** ne fait rien : ni
  voile, ni déplacement, la carte revient en place. Et comme il n'y aurait rien à
  déclencher, **la pastille correspondante n'est pas affichée du tout** : le bord reste nu.
  Configurer les quatre destinations n'est pas obligatoire.
- Les **pastilles de bord sont aussi cliquables**. Sur un ordinateur, viser une pastille à
  la souris est plus simple que de dessiner un glissement, et un bouton reste accessible
  au lecteur d'écran là où un geste ne l'est pas.
- Les **flèches du clavier** envoient la photo dans la direction correspondante, ce qui
  permet de tester le tri sur un ordinateur sans souris. Elles appellent `preventDefault()`
  pour ne pas faire défiler la page en même temps.
- Un swipe est un déplacement comme un autre : `Cancel` **annule aussi un swipe**, pas
  seulement un `Delete`. Il défait toujours le dernier déplacement en date, quelle qu'en
  soit l'origine.
- La logique du geste est isolée dans `src/tri/geste.ts`, en fonctions **pures**
  (`directionDuGeste`, `rotationCarte`). Elles se testent en une ligne, sans simuler ni
  navigateur ni doigt, et c'est là que se trouvent les règles de seuil et d'axe dominant.
- Pendant qu'un déplacement est en cours, un nouveau geste est ignoré : sans cela, deux
  `PATCH` partiraient pour le même fichier.

### Contenu du Lot 7

La mise en ligne, décrite en détail dans « Mettre l'application en ligne » plus haut.

- `.github/workflows/deploiement.yml` : à chaque poussée sur `main`, les types sont
  vérifiés, les tests lancés, l'application construite puis publiée. Un échec de test
  empêche la publication.
- `public/staticwebapp.config.json` : renvoie `index.html` pour toute URL inconnue, sans
  quoi recharger la page sur `/tri` donnerait une 404.
- Le Client ID passe par une **variable** de dépôt et non par un secret : il circule en
  clair dans chaque URL de connexion Microsoft, le ranger parmi les secrets laisserait
  croire qu'il protège quelque chose.
- Pas de déploiement de préversion sur les pull requests : leurs URL changent à chaque
  fois et ne peuvent pas être déclarées dans Entra.

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
  leur direction**, sur l'écran de configuration.
- Le titre « TriPhoto » est remplacé par un logo (`src/ui/Logo.tsx`) : un appareil photo
  entouré des quatre flèches de direction. Les couleurs y sont lues dans
  `src/tri/directions.ts`, jamais réécrites en dur, pour que le logo suive la palette.
- Avant connexion, l'écran ne montre **que le logo, en grand, et le bouton de
  connexion**. L'ancienne « boussole » qui listait les quatre directions a été retirée :
  elle décrivait des dossiers que l'utilisatrice n'avait pas encore choisis, et le logo
  porte déjà les quatre couleurs.

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