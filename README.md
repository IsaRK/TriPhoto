# TriPhoto

Trier rapidement les photos et vidéos d'un dossier OneDrive, à la manière de Tinder :
chaque média est envoyé vers l'un des dossiers de destination d'un simple geste.

**Application en ligne : <https://isark.github.io/TriPhoto/>** — attention aux majuscules
de `TriPhoto`, GitHub Pages y est sensible (voir « [L'adresse exacte, et le piège de la
casse](#ladresse-exacte-et-le-piège-de-la-casse) »).

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

### Pourquoi GitHub Pages, et ce que cela implique

Le code est déjà sur GitHub : Pages évite d'ouvrir un compte ailleurs et de confier le
déploiement à un tiers de plus. C'est gratuit, le HTTPS est fourni, et la publication
tient dans un fichier de workflow.

La contrepartie est que **le dépôt doit être public** — Pages sur un dépôt privé demande
un abonnement payant. C'est acceptable ici parce qu'il n'y a rien à cacher dans ce code :
aucun secret, aucune clé, et le Client ID est public par construction. Avant de basculer
la visibilité, il reste prudent de vérifier que rien de sensible ne dort dans l'historique
des commits, car rendre un dépôt public expose tous les commits passés, pas seulement le
dernier.

Deux conséquences techniques, toutes deux déjà traitées dans le code :

- **Le site vit dans un sous-dossier**, `https://<compte>.github.io/TriPhoto/`, et non à
  la racine d'un domaine. D'où `base` dans `vite.config.ts` (pour que les fichiers
  construits soient cherchés au bon endroit) et `basename` sur le `BrowserRouter` (pour
  que React Router ne prenne pas `/TriPhoto/tri` pour une route inconnue).
- **L'URI de redirection Microsoft doit inclure ce sous-dossier.** C'est le piège le plus
  coûteux : en renvoyant vers la seule origine, Microsoft ramènerait sur la page d'accueil
  du compte GitHub, hors de l'application. La fonction `calculerRedirectUri` s'en charge
  et est couverte par des tests.

L'application utilise `BrowserRouter`, donc `/tri` est une vraie adresse. Or GitHub Pages
ne sait pas rediriger les URL inconnues vers l'application : recharger la page pendant le
tri afficherait sa page d'erreur. Le workflow contourne cela en publiant une copie
d'`index.html` sous le nom `404.html`. GitHub la sert alors pour toute adresse inconnue —
avec un statut 404 sans conséquence — et l'application démarre normalement.

### La marche à suivre

1. Rendre le dépôt public : **Settings → General → Danger Zone → Change visibility**.
2. Dans **Settings → Pages**, choisir **Source : GitHub Actions** (et non « Deploy from a
   branch »).
3. Dans **Settings → Secrets and variables → Actions**, onglet **Variables**, bouton
   **New repository variable** : nom `VITE_MSAL_CLIENT_ID`, valeur = le Client ID de
   l'app registration. C'est une variable et non un secret, parce que ce n'est pas un
   secret : il circule en clair dans chaque URL de connexion Microsoft.
4. Pousser sur `main` : le workflow vérifie les types, lance les tests, construit
   l'application et la publie. L'onglet **Actions** montre le déroulement, et l'adresse
   obtenue s'affiche à la fin du travail `publier`.
5. Ajouter cette adresse — `https://<compte>.github.io/TriPhoto/`, **avec** la barre
   oblique finale — dans l'app registration Entra, sous **Authentication → Single-page
   application → Add URI**. Entra compare les URI caractère par caractère : une barre
   oblique en trop ou en moins suffit à faire échouer la connexion.

Le déploiement n'a volontairement **pas** lieu sur les pull requests : il n'existe qu'un
seul site Pages par dépôt, donc publier une branche écraserait la version en service.

## Installer TriPhoto sur le téléphone

### L'adresse exacte, et le piège de la casse

<img src="docs/qr-triphoto.svg" alt="QR code vers https://isark.github.io/TriPhoto/" width="200" align="right" />

L'adresse du site est **`https://isark.github.io/TriPhoto/`**, avec un **T** et un **P**
majuscules.

GitHub Pages distingue les majuscules des minuscules dans le chemin. `triphoto`,
`Triphoto` ou l'adresse sans le nom du dépôt renvoient tous la vraie page **404** de
GitHub, alors que le site fonctionne parfaitement :

| Adresse ouverte | Résultat |
| --- | --- |
| `https://isark.github.io/TriPhoto/` | l'application |
| `https://isark.github.io/triphoto/` | 404 GitHub |
| `https://isark.github.io/Triphoto/` | 404 GitHub |
| `https://isark.github.io/` | 404 GitHub |

C'est le piège classique sur téléphone, où le clavier écrit spontanément en minuscules.
**Le plus simple est de ne jamais taper cette adresse** : scanner le QR code ci-contre
avec l'appareil photo du téléphone, puis installer l'application (section suivante). Elle
se lance ensuite depuis son icône, et la question de l'adresse ne se pose plus jamais.

Un détail à ne pas confondre avec une panne : recharger la page en étant sur `/tri`
renvoie techniquement un code 404, mais **affiche bien l'application**. C'est le repli
`404.html` décrit plus haut. Un message d'erreur 404 réellement visible signifie donc
toujours une adresse en dehors du dépôt.

### Installer

Une fois l'application en ligne, elle s'installe comme une application ordinaire, sans
passer par un magasin d'applications et sans rien signer.

- **Android (Chrome)** : ouvrir l'adresse, puis le menu **⋮ → Installer l'application**.
  Chrome propose souvent l'installation de lui-même, en bas de l'écran.
- **iPhone (Safari)** : ouvrir l'adresse, appuyer sur **Partager**, puis **Sur l'écran
  d'accueil**. L'installation depuis Chrome ou Firefox sur iPhone ne fonctionne pas :
  iOS réserve cette possibilité à Safari.

L'icône obtenue est la marque du logo, et l'application s'ouvre **sans la barre d'adresse**
du navigateur. Ce n'est pas qu'une question d'allure : la barre d'adresse mange une partie
de l'écran, et surtout le geste de balayage horizontal y déclenche le retour arrière du
navigateur, ce qui entrerait en conflit avec les swipes du tri.

L'application se lance ensuite même sans réseau, mais ne montrera aucune photo : les
médias vivent sur OneDrive. Seule l'enveloppe est mise en cache, jamais les données —
voir la section suivante.

### Ce que le service worker met en cache, et ce qu'il ne met pas

Un service worker est un petit programme que le navigateur garde à côté du site pour lui
servir des fichiers sans réseau. Celui de TriPhoto est produit par `vite-plugin-pwa`, et
sa configuration tient en deux règles, toutes deux dans `src/pwa/configurationPwa.ts` :

- **Aucune réponse de Microsoft Graph n'est mise en cache.** Le service worker ne connaît
  que les fichiers de l'application. C'est volontaire : une liste de médias gardée en
  cache proposerait de trier des photos déjà déplacées, et les réponses Graph contiennent
  des données privées qui n'ont rien à faire dans le stockage du navigateur.
- **Une nouvelle version s'installe d'elle-même, mais ne coupe jamais un tri en cours.**
  Le mode `autoUpdate` du plugin pose `skipWaiting` et `clientsClaim` : le service worker
  fraîchement téléchargé s'active immédiatement. Le mode par défaut avait d'abord été
  retenu, en pensant que la version en attente s'activerait à la fermeture de
  l'application — c'était une erreur. Une PWA posée sur l'écran d'accueil n'est
  pratiquement jamais fermée, elle reste dans les tâches récentes du téléphone : la
  version en attente ne s'activait donc **jamais**, et on triait indéfiniment avec
  l'ancienne, sans rien pour le signaler.
- **La page se recharge quand la nouvelle version prend la main** (`src/pwa/serviceWorker.ts`),
  sauf dans deux cas : au tout premier chargement, où aucune version ne contrôlait encore
  la page — ce n'est pas une mise à jour —, et **pendant un tri**, parce que le média
  affiché et la pile d'annulation vivent en mémoire. La nouvelle version attend alors le
  retour à l'écran de configuration.

### Régénérer les icônes

Les icônes sont dessinées dans `public/icone.svg` (l'onglet et l'écran d'accueil) et
`public/icone-maskable.svg` (la variante rognée par Android). Les `.png` publiés en sont
le rendu : ils existent parce qu'iOS et Android exigent des PNG, mais **le SVG reste la
source**. Après modification d'un SVG, refaire les rendus en 512 × 512 et 192 × 192 avec
n'importe quel outil d'export, en gardant les noms de fichiers existants. Un test vérifie
que les couleurs des SVG correspondent toujours à la table des directions.

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
| Lot 7 | Mise en ligne : GitHub Pages, workflow GitHub Actions | ✅ Terminé |
| Lot 8 | PWA : manifeste, icônes, service worker, installation sur le téléphone | ✅ Terminé |
| Lot 9 | Écran de tri entièrement en anglais, coins réorganisés, bouton `Exit` | ✅ Terminé |
| Lot 10 | Mises à jour qui arrivent vraiment sur le téléphone | ✅ Terminé |
| Lot 11 | Interface entièrement en anglais, écran de configuration compris | ✅ Terminé |
| Lot 12 | Revue de sécurité et durcissement de la pagination Graph | ✅ Terminé |
| Lot 13 | Liens OneDrive expirés renouvelés tout seuls pendant le tri | ✅ Terminé |
| Lot 14 | Annulations multiples : remonter plusieurs photos de suite | ✅ Terminé |
| Lot 15 | Relire le dossier pour prendre les photos arrivées pendant le tri | ✅ Terminé |
| Lot 16 | La racine du OneDrive devient un dossier choisissable comme un autre | ✅ Terminé |
| Lot 17 | Mélange de OneDrive refusé dès la configuration, documentation corrigée | ✅ Terminé |

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
  (ce dernier permet de lire et d'écrire dans un dossier partagé, qui vit dans le
  OneDrive de quelqu'un d'autre ; voir la section dédiée)
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
- « Start sorting » reste désactivé tant qu'un dossier source et au moins une
  destination ne sont pas choisis
- Chaque emplacement peut être vidé individuellement

La poubelle est facultative pour démarrer le tri ; le bouton « Delete » de l'écran
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
d'une direction agissent déjà : `Delete` envoie le média à la poubelle,
`Cancel last action` le ramène, `Skip` passe au suivant. Les **gestes de swipe** vers les
quatre destinations sont le sujet du Lot 6, décrit plus bas.

- Les médias du dossier à trier sont affichés **un par un**, en **plein écran**, du plus
  ancien au plus récent, avec la progression (`12 / 340`) et la date de prise de vue
- La photo est affichée entière (jamais rognée) sur un fond sombre : rogner ferait
  décider sur un cadrage que le fichier n'a pas
- Les **quatre destinations** sont posées par-dessus, au milieu de chaque bord, avec leur
  couleur et leur titre court. Ce sont de petites pastilles bien rondes, aussi compactes que
  leur titre le permet, prolongées d'une **pointe** du côté vers lequel on envoie la photo.
  La flèche découpée d'une première version imposait une pointe longue et une hauteur fixe
  qui mangeaient l'image.
- Les **quatre boutons des coins** : `Home` (haut gauche), `Skip` (haut droite),
  `Delete` (bas gauche), `Cancel last action` (bas droite). Ils portent leur mot seul, sans
  pictogramme, et ne répondent qu'au clic : aucun geste de swipe ne leur est associé.
  `Cancel last action` est le seul écrit sur **deux lignes** — d'un seul tenant, il barrerait
  le bas de l'écran et viendrait toucher la pastille de la direction du bas.
- `Home`, `Delete` et `Skip` sont **toujours actifs**. Seul `Cancel last action` peut être
  inactif : il n'a rien à annuler tant qu'aucun média n'a été déplacé. Il est alors
  estompé, ce qui est ici une information juste et non un défaut d'affichage, puisque les
  trois autres ne le sont jamais.
- **Supprimer ne supprime pas** : `Delete` déplace le média vers le dossier Poubelle
  configuré, par un `PATCH /drives/{driveId}/items/{itemId}` avec
  `{ "parentReference": { "id": "<idPoubelle>" } }`.
- **Annuler** refait le même appel en sens inverse, vers le dossier à trier, et **réaffiche la
  photo récupérée**. `Cancel last action` défait le **dernier déplacement en date**, puis celui
  d'avant, puis celui d'encore avant : la pile se dépile à chaque appui, jusqu'à revenir au
  début du tri. Le bouton redevient inactif quand il n'y a plus rien à annuler.
- `Cancel last action` reste proposé sur l'écran « Sorting complete » tant qu'un déplacement
  est encore rattrapable : sans cela, les derniers médias envoyés à la poubelle ne seraient
  plus récupérables depuis TriPhoto.
- Un déplacement qui échoue **ne perd rien** : la liste et la pile d'annulation restent en
  place, un message s'affiche et le geste peut être refait.
- Un dossier situé sur **un autre OneDrive** (dossier partagé) est refusé avec un message
  clair : `PATCH parentReference` ne traverse pas les drives. Depuis le Lot 17, le refus
  arrive dès l'écran de configuration et non plus au premier geste de tri.
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
- Un swipe est un déplacement comme un autre : `Cancel last action` **annule aussi un
  swipe**, pas seulement un `Delete`. Il défait toujours le dernier déplacement en date,
  quelle qu'en soit l'origine, et les appuis suivants remontent la pile de la même façon.
- La logique du geste est isolée dans `src/tri/geste.ts`, en fonctions **pures**
  (`directionDuGeste`, `rotationCarte`). Elles se testent en une ligne, sans simuler ni
  navigateur ni doigt, et c'est là que se trouvent les règles de seuil et d'axe dominant.
- Pendant qu'un déplacement est en cours, un nouveau geste est ignoré : sans cela, deux
  `PATCH` partiraient pour le même fichier.

### Contenu du Lot 7

La mise en ligne sur GitHub Pages, décrite en détail dans « Mettre l'application en
ligne » plus haut.

- `.github/workflows/deploiement.yml` : à chaque poussée sur `main`, les types sont
  vérifiés, les tests lancés, l'application construite puis publiée. Un échec de test
  empêche la publication.
- Le site vit dans le sous-dossier `/TriPhoto/`. D'où `base` dans `vite.config.ts` et
  `basename` sur le `BrowserRouter`, tous deux tirés de la même valeur pour qu'ils ne
  puissent pas diverger.
- `calculerRedirectUri` fait pointer la redirection Microsoft vers ce sous-dossier. Sans
  cela, la connexion ramènerait sur la page d'accueil du compte GitHub, hors de
  l'application. Trois tests couvrent les trois cas : développement, téléphone sur le
  réseau local, et production.
- Le workflow publie une copie d'`index.html` sous le nom `404.html` : c'est ce qui permet
  de recharger la page pendant le tri sans tomber sur l'erreur de GitHub.
- `public/.nojekyll` : GitHub Pages passe par défaut les fichiers dans Jekyll, qui ignore
  les dossiers commençant par un tiret bas. Ce fichier vide désactive ce traitement.
- Le Client ID passe par une **variable** de dépôt et non par un secret : il circule en
  clair dans chaque URL de connexion Microsoft, le ranger parmi les secrets laisserait
  croire qu'il protège quelque chose.
- Pas de déploiement sur les pull requests : il n'existe qu'un seul site Pages par dépôt,
  publier une branche écraserait la version en service.

### Contenu du Lot 8

L'application devient installable, ce qui est décrit du point de vue de l'usage dans
« Installer TriPhoto sur le téléphone » plus haut.

- `src/pwa/configurationPwa.ts` : le manifeste et les options du service worker. Ils sont
  dans un fichier du code, et non enfouis dans `vite.config.ts`, parce qu'une erreur y
  passerait inaperçue — rien ne casse à la construction, et le défaut ne se voit qu'en
  installant l'application sur un téléphone. Des tests relisent donc ces valeurs.
- `start_url` et `scope` sont **relatifs** (`.`) et non absolus. C'est le même piège que
  pour la redirection Microsoft : un `/` aurait fait démarrer l'application installée sur
  `https://isark.github.io`, hors de TriPhoto.
- `src/pwa/serviceWorker.ts` : l'enregistrement est écrit à la main, une dizaine de lignes
  lisibles, plutôt que laissé à l'injection automatique du plugin. Il ne fait rien en
  développement, où `sw.js` n'existe pas, et un échec n'empêche jamais l'application de
  démarrer — on perd seulement le fonctionnement hors ligne.
- Les icônes sont dérivées du logo, sans le mot « TriPhoto » qui serait illisible en
  48 pixels. Une variante « maskable » garde la marque dans la zone sûre, parce qu'Android
  rogne les icônes selon la forme du lanceur.
- `index.html` déclare en plus `apple-touch-icon` : iOS ignore les icônes du manifeste et
  mettrait sinon une capture de la page sur l'écran d'accueil.
- Ni Graph en cache, ni mise à jour subie en plein tri : les deux décisions sont
  expliquées dans « Ce que le service worker met en cache », et chacune est tenue par un
  test.

### Contenu du Lot 9

Retouches d'interface demandées à l'usage, sans nouvel appel Graph.

- **L'écran de tri est entièrement en anglais.** Jusqu'ici seuls les quatre boutons des
  coins l'étaient, ce qui donnait un écran bilingue : `Skip` voisinait avec « Tri
  terminé ». Tout ce que cet écran affiche est passé à l'anglais — titres, messages
  d'erreur, écrans « Nothing to sort », « Sorting complete », « Session expired », jusqu'à
  la date de prise de vue, formatée en `en-GB` (`14 July 2024`) et non plus en `fr-FR`.
- **L'écran de configuration restait en français** à ce stade, à l'exception de `Connect
  with Microsoft` et du nouveau bouton `Exit`. Il est passé en anglais au Lot 11.
- **Les coins ont été réorganisés** : `Skip` passe en haut à droite et
  `Cancel last action` en bas à droite. Les deux boutons qui font avancer le tri (`Delete`,
  `Skip`) se retrouvent ainsi aux extrémités opposées, et l'annulation n'est plus voisine
  du retour à l'accueil.
- **`Cancel` devient `Cancel last action`**, sur deux lignes. Le nom d'origine ne disait
  pas ce qui était annulé ; le nouveau tient en deux lignes centrées plutôt que de barrer
  le bas de l'écran. La disposition a été vérifiée dans le pire cas — quatre titres courts
  de dix caractères larges — pour s'assurer qu'aucun bouton n'en touche un autre.
- **Bouton `Exit`**, une croix blanche sur pastille rouge, en haut à droite de l'écran de
  configuration. Il ferme l'application. Un navigateur n'autorise `window.close()` que sur
  les fenêtres qu'il a lui-même ouvertes : depuis un onglet ordinaire, la page reste donc
  affichée et un message le dit, plutôt que de laisser croire à un bouton cassé. Installée
  sur l'écran d'accueil, l'application se ferme normalement.
- Le rouge du bouton `Exit` est la seule couleur ajoutée à la palette. Elle n'est partagée
  avec aucune direction : c'est la seule action qui ferme tout.

### Contenu du Lot 10

Correction d'un vrai défaut, découvert à l'usage : **les mises à jour n'arrivaient jamais
sur le téléphone**. L'application installée continuait d'afficher indéfiniment la version
du jour de son installation. Le détail du mécanisme et des garde-fous est dans « Ce que le
service worker met en cache, et ce qu'il ne met pas ».

- Le service worker passe en `autoUpdate` : la version téléchargée s'active au lieu
  d'attendre une fermeture qui n'arrive jamais sur un téléphone.
- La page se recharge quand la nouvelle version prend la main, sauf pendant un tri et sauf
  à la première installation.
- Quatre tests couvrent ces règles, et deux mutations (retrait de la garde anti-boucle,
  retrait de la garde du tri en cours) les font bien échouer.

#### Passer à cette version sur un téléphone déjà équipé

L'ancienne version installée ne sait pas encore se mettre à jour toute seule ; c'est
précisément ce qui est corrigé ici. Une fois : ouvrir TriPhoto, **attendre une dizaine de
secondes** que la nouvelle version se télécharge, fermer complètement l'application (la
retirer des applications récentes, pas seulement revenir à l'écran d'accueil), puis la
rouvrir. Les mises à jour suivantes arriveront d'elles-mêmes.

### Contenu du Lot 11

**Toute l'interface est maintenant en anglais**, écran de configuration compris. Le Lot 9
n'avait traduit que l'écran de tri, ce qui laissait une application à deux langues selon
l'écran.

- Écran de configuration : libellés des six emplacements (`Folder to sort`, `Left`,
  `Right`, `Up`, `Down`, `Trash`), `Short title`, `No folder`, `Start sorting`, `Cancel`,
  et les messages qui expliquent ce qui manque encore.
- Explorateur de dossiers : `Loading folders…`, `Choose this folder`, `This folder has no
  subfolder.`, `shared`, `empty`, `1 item` / `N items`, fil d'Ariane.
- Compte Microsoft : `Signing in…`, `Signed in as`, `Sign out`, `Sign in again`,
  `Try again`, et l'écran de démarrage (`Starting…`, `Incomplete configuration`,
  `Startup failed`).
- Messages d'erreur de la couche Graph (`src/graph/*.ts`) : ils remontent tels quels à
  l'écran, les laisser en français aurait ramené du français au milieu de l'anglais.
- `index.html` et le manifeste passent en `lang: 'en'`, avec une description traduite : la
  langue déclarée doit correspondre à celle de la page, et la description s'affiche au
  moment de l'installation.
- Le `libelle` des directions est traduit dans `src/tri/directions.ts`, qui reste la source
  de vérité unique. Les titres courts, eux, sont saisis par l'utilisatrice et ne sont
  traduits par personne.
- **Le bouton `Exit` n'apparaît plus avant la connexion** : l'écran d'accueil ne montre
  alors que le logo et `Connect with Microsoft`, une croix de fermeture y serait la seule
  autre chose à cliquer.

Le code, les commentaires et cette documentation restent en français : c'est l'interface
qui est en anglais, pas le projet.

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

### Conséquence sur le tri : tout doit vivre sur le même OneDrive

Microsoft Graph refuse de déplacer un fichier d'un drive vers un autre :
*« Items cannot be moved between Drives using this request »*. Le
`PATCH parentReference` utilisé pour un tri ordinaire ne franchit pas cette
frontière.

**TriPhoto ne contourne pas cette limite.** Un contournement existe — copier le
fichier avec `POST /drives/{driveId}/items/{id}/copy`, opération asynchrone qu'il
faut ensuite interroger jusqu'à son terme, puis déplacer l'original vers la
Poubelle — mais il a été écarté :

- il laisse **une copie chez le propriétaire du dossier partagé**, qu'une
  annulation ne pourrait pas défaire sans supprimer un fichier chez quelqu'un
  d'autre — ce que TriPhoto ne fera pas ;
- une copie est bien plus lente qu'un déplacement, alors que le tri se veut
  immédiat ;
- il rendrait « annuler » asymétrique : le geste ne serait plus réversible, alors
  que c'est toute la promesse du bouton.

La règle est donc simple : **le dossier à trier, les quatre destinations et la
Poubelle doivent appartenir au même OneDrive.** Le mélange est refusé dès l'écran
de configuration, avec un message qui nomme l'emplacement en conflit — plutôt que
de laisser chaque geste de tri échouer une fois le tri lancé.

Rien n'interdit en revanche de trier **entièrement à l'intérieur** d'un drive
partagé : la source et les destinations y sont alors toutes les deux, et les
déplacements restent internes à ce drive. C'est ce que permet le scope
`Files.ReadWrite.All`.

## Limitations connues

- Un dossier partagé par quelqu'un d'autre n'est visible qu'après un « Ajouter un
  raccourci à Mes fichiers » ; il n'y a pas de découverte automatique des partages,
  faute d'API pérenne.
- Écrire dans un dossier partagé suppose que son propriétaire vous a donné le droit
  de **modification**, pas seulement de lecture.
- On ne peut pas trier depuis son propre OneDrive vers un dossier partagé, ni
  l'inverse : Graph ne déplace pas un fichier d'un drive à l'autre.
- OneDrive ne produit pas toujours la miniature de tous les fichiers d'une page.
  Les médias concernés sont conservés avec une miniature absente, à charge de
  l'écran de tri de se rabattre sur le fichier lui-même.
## Contenu du Lot 12

Une revue de sécurité complète du dépôt a été menée : secrets et historique git,
stockage des jetons MSAL, construction des URL Graph, risques XSS, service worker,
redirection MSAL, dépendances, workflow GitHub Actions et réglages du dépôt.

**Aucune vulnérabilité exploitable n'a été trouvée** : pas de secret dans le code
ni dans l'historique, `npm audit` à zéro, aucun `dangerouslySetInnerHTML`, workflow
de déploiement aux permissions minimales.

Deux suites ont été données à cette revue.

### Contrôle d'hôte sur la pagination Graph

Les listes OneDrive arrivent par pages : chaque réponse peut contenir un champ
`@odata.nextLink`, l'adresse de la page suivante, que l'on rappelle **avec le jeton
d'accès dans l'en-tête**. Cette adresse vient de Microsoft, mais rien dans le code
ne le vérifiait. La fonction `verifierUrlGraph` (dans `src/graph/dossiers.ts`)
contrôle désormais que l'URL commence bien par `https://graph.microsoft.com/` avant
chaque appel de pagination, dans la liste des dossiers comme dans celle des médias.
Sinon, le tri s'arrête avec un message clair plutôt que d'envoyer le jeton ailleurs.

C'est une ceinture en plus de la bretelle : trois lignes, deux tests, et le jeton ne
peut plus quitter le domaine de Graph.

### Filets de sécurité activés sur le dépôt

Ces réglages GitHub gratuits étaient tous désactivés :

| Réglage | Ce qu'il fait |
| --- | --- |
| Alertes Dependabot | Prévient quand une dépendance a une faille connue |
| Mises à jour de sécurité Dependabot | Ouvre automatiquement la PR de correction |
| Secret scanning | Détecte un secret déjà présent dans le dépôt |
| Protection contre l'envoi de secrets | Bloque un `push` qui contiendrait un secret |

Le dépôt étant public, ils sont tous gratuits. Le dernier est le plus utile au
quotidien : il refuse le `push` **avant** que le secret n'atteigne GitHub.

La protection de branche sur `main` reste volontairement désactivée : sur un projet
à une seule personne, elle empêcherait le merge direct des PR sans rien protéger de
plus.

## Contenu du Lot 13

Les liens que Microsoft Graph renvoie pour afficher une photo — l'URL de
téléchargement comme celle de la miniature — sont **signés et temporaires** :
ils expirent au bout d'environ une heure. Jusqu'ici, la liste des médias était
lue une seule fois à l'entrée dans l'écran de tri, avec les liens de ce
moment-là. Au bout d'une heure de tri, les photos cessaient donc de s'afficher
alors que tout allait bien côté OneDrive, et il fallait recharger la page — en
perdant au passage la possibilité d'annuler le dernier envoi à la poubelle.

### Comment le problème est repéré

Aucun minuteur, aucune date d'expiration à suivre : on écoute simplement
l'évènement `error` de la balise `<img>` ou `<video>`. C'est le navigateur
lui-même qui dit que le lien ne marche plus, ce qui couvre l'expiration comme
n'importe quelle autre panne de lien.

### Ce qui se passe alors

`relireMedia` (dans `src/graph/medias.ts`) redemande à Graph **ce seul média**,
avec les mêmes champs que la liste, et l'écran remplace l'ancienne entrée par la
nouvelle, à la même place. La position dans le tri, la progression affichée et le
média mémorisé pour « Cancel last action » ne bougent pas : l'utilisateur ne voit
qu'un bref clignotement.

Le média suivant, celui qui est préchargé hors de l'écran, bénéficie du même
traitement : si son lien a expiré, il est renouvelé avant même d'être affiché.

### Et si le lien frais ne marche pas non plus

On n'essaie **qu'une fois par média et par passe**. Un second échec veut dire
autre chose qu'un lien périmé — fichier supprimé entre-temps, format que le
navigateur ne sait pas lire — et réessayer en boucle ne ferait que marteler
Graph. Dans ce cas la carte affiche un message clair, et les boutons « Delete »
et « Skip » restent actifs : un média qu'on ne peut pas voir reste un média qu'on
peut ranger. Le bouton « Review again », qui relance une passe sur le même
dossier, efface cette mémoire : une heure plus tard, les liens renouvelés ont pu
expirer à leur tour et chaque média mérite une seconde chance.

### Deux pièges évités

Le raisonnement porte sur **l'URL** et non sur le média. La carte affichée et le
média préchargé hors écran peuvent buter sur le même lien expiré à quelques
instants d'intervalle ; sans cette distinction, le second échec aurait été pris
pour l'échec du lien frais, et une photo parfaitement valide se serait retrouvée
condamnée pour le reste de la session.

Une **session Microsoft expire elle aussi au bout d'une heure**. C'est le même
moment, mais pas le même problème : si la relecture échoue faute de jeton, l'écran
propose de se reconnecter, au lieu d'accuser les médias les uns après les autres.

## Contenu du Lot 14

Jusqu'ici, « Cancel last action » ne défaisait **que le dernier déplacement** :
une fois la photo d'avant rangée, elle l'était pour de bon. Le cahier des charges
demandait une pile permettant plusieurs annulations successives ; c'est
maintenant le cas.

### Une pile plutôt qu'un seul souvenir

L'écran de tri garde la liste de tous les déplacements de la session, du plus
ancien au plus récent : pour chacun, le média et sa position dans la liste.
Chaque appui sur « Cancel last action » renvoie le média du sommet vers le
dossier à trier, le réaffiche, puis **dépile**. Un second appui remonte le
déplacement d'avant, un troisième celui d'encore avant, jusqu'à revenir au début
du tri. Le bouton ne redevient estompé que lorsqu'il n'y a plus rien à annuler.

Cela vaut pour **tous** les déplacements, sans distinction : un swipe vers une
destination s'annule exactement comme un envoi à la poubelle.

### On ne dépile qu'une fois Graph d'accord

Le retrait de la pile se fait dans la fonction appelée **après** la réponse de
Microsoft Graph, jamais avant. Une annulation qui échoue — réseau coupé, Graph
indisponible — laisse donc la pile intacte : le message s'affiche, et le même
bouton permet de réessayer. C'est la règle déjà appliquée aux déplacements
eux-mêmes : une panne réseau ne doit jamais coûter le travail déjà fait.

### Pourquoi aucune limite de profondeur

Un déplacement mémorisé ne pèse que quelques centaines d'octets, et le tri d'un
dossier se compte en centaines de photos, pas en millions. Plafonner la pile
aurait ajouté un réglage à comprendre et une limite à expliquer, pour une
économie de mémoire invisible.

La pile est remise à zéro dans les deux cas où les positions qu'elle mémorise
cessent d'avoir un sens : quand la liste des médias est relue, et quand
« Review again » repart du premier média. Sans cette seconde remise à zéro, une
annulation de trop lors de la seconde passe ferait ressortir de son dossier une
photo rangée pendant la première.

## Contenu du Lot 15

La liste des médias est lue **une seule fois**, à l'entrée dans l'écran de tri.
C'est voulu : une liste qui bougerait toute seule ferait sauter la photo sous le
doigt au moment du swipe, et la position mémorisée pour l'annulation ne voudrait
plus rien dire. L'effet de bord était qu'une photo déposée dans le dossier
pendant le tri restait invisible jusqu'au rechargement complet de l'application.

### Un bouton, au seul moment où c'est sans risque

Le bouton **`Check for new photos`** redemande la liste à OneDrive. Il n'apparaît
qu'aux deux moments où il n'y a plus rien à interrompre :

- sur l'écran **`Sorting complete`**, quand tous les médias ont été vus ;
- sur l'écran **`Nothing to sort`**, quand le dossier était vide à l'ouverture.

Pendant le tri lui-même, il n'y a pas de bouton de rafraîchissement : perdre sa
place au milieu de trois cents photos coûte bien plus cher que d'attendre la fin
de la passe.

### Deux boutons voisins qui ne font pas la même chose

Sur l'écran de fin, `Review again` et `Check for new photos` se ressemblent, mais
ne lisent pas la même source :

| Bouton | Ce qu'il fait | Quand s'en servir |
| --- | --- | --- |
| `Review again` | Repasse sur la liste **déjà en mémoire**, depuis le premier média | Revoir ce qu'on vient de trier |
| `Check for new photos` | **Redemande la liste à OneDrive** | Prendre les photos arrivées entre-temps |

Après une relecture, le dossier ne contient plus que les médias qu'on n'a pas
rangés : ceux passés avec `Skip`, et les nouveaux. La liste est donc
naturellement plus courte à chaque passe, jusqu'à ce qu'il ne reste rien.

### Une relecture, c'est une session de tri neuve

Le bouton se contente d'incrémenter un compteur (`tentative`) que l'effet de
chargement surveille. Tout le reste est déjà écrit : c'est cet effet qui remet à
zéro la position, la pile d'annulation et la mémoire des échecs d'affichage.
Aucun chemin de remise à zéro en double, donc aucun risque d'en oublier un.

La contrepartie est assumée : relire le dossier **vide la pile d'annulation**.
Les positions qu'elle mémorise désignent des rangs dans l'ancienne liste, qui
n'existe plus. Un média envoyé à la poubelle juste avant une relecture reste
récupérable depuis OneDrive, simplement plus depuis TriPhoto.

Un échec de relecture (réseau coupé, Graph indisponible) retombe sur l'écran
d'erreur ordinaire, avec son bouton `Try again` : il n'y a pas eu de second
mécanisme d'erreur à écrire.

### Ne pas relire pendant qu'un déplacement est en vol

C'est le défaut trouvé en relecture de ce lot, et il n'était pas évident. Les
boutons `Cancel last action` et `Check for new photos` voisinent sur l'écran de
fin. Rien ne bouge à l'écran pendant l'appel à Graph : on peut donc croire que
l'annulation n'a pas pris, et cliquer sur le second bouton.

Or une lecture de page coûte moins cher qu'un déplacement de fichier. La liste
neuve arrivait alors **avant** la réponse du `PATCH`, et la fonction de succès du
déplacement posait ensuite `setIndex(dernier.index)` — une position de l'ancienne
liste — sur la nouvelle. Selon les tailles respectives, on tombait soit sur un
écran « Sorting complete » pour une liste que personne n'avait vue, soit sur un
démarrage au milieu de la liste, les premiers médias silencieusement sautés.

La correction suit la règle déjà appliquée partout ailleurs dans l'écran : toute
action est refusée tant que `deplacementEnCours` est vrai. Les trois boutons de
l'écran de fin sont en plus **estompés** pendant l'appel, pour que l'attente se
voie au lieu d'être devinée. `Review again` avait le même trou, et reçoit le même
garde-fou.

Au passage, un message d'échec de déplacement ne survit plus à une relecture ni à
un `Review again` : il parlait d'une liste qui n'existe plus.

## Contenu du Lot 16

Le dossier racine du OneDrive ne pouvait pas être choisi, ni comme dossier à
trier ni comme destination. Le bouton `Choose this folder` restait estompé tant
qu'on n'avait pas ouvert un sous-dossier. C'était gênant pour qui garde ses
photos directement à la racine, et surtout incohérent : la racine est un dossier
comme un autre.

### Pourquoi c'était bloqué

L'explorateur construit un fil d'Ariane dont la première étape est la racine. Il
n'avait à ce moment-là aucun identifiant à lui donner : on lit ses enfants par
`GET /me/drive/root/children`, une adresse par **chemin**, qui ne révèle jamais
l'identifiant de l'élément lui-même. Or un déplacement Graph se fait vers
`parentReference.id`, donc vers un **identifiant**. Sans lui, la racine ne pouvait
figurer dans la configuration.

### Un appel de plus, mémorisé

`lireDossierRacine` demande `GET /me/drive/root?$select=id` et retourne cet
identifiant accompagné de celui du drive. Comme celui du drive, il ne change
jamais pour un compte donné : il est mémorisé dans le module, et le réseau n'est
donc sollicité qu'une seule fois par session, au premier affichage de la racine.

La fonction de remise à zéro réservée aux tests s'appelle maintenant
`oublierLesIdentifiantsMemorises` : elle en oublie deux, son ancien nom
`oublierIdDeMonDrive` aurait menti.

### Ce que ça change à l'écran

- `Choose this folder` devient actif à la racine, dès que Graph a répondu. Tant
  que la réponse n'est pas là, il reste estompé : on ne propose pas un choix
  qu'on ne saurait pas enregistrer.
- La note « Open a folder to be able to choose it » a disparu, puisqu'elle est
  devenue fausse. Le rappel sur les dossiers partagés, lui, reste affiché en
  permanence — il était auparavant caché dès qu'on descendait d'un niveau, alors
  que c'est justement là qu'on en a besoin.
- Une configuration enregistrée sur la racine s'affiche avec le chemin
  `OneDrive`, comme n'importe quel autre dossier.

### Un échec de lecture de la racine ne bloque plus rien

Trouvé en relecture : cet appel supplémentaire était enchaîné devant la liste des
dossiers. S'il échouait — un `429` de Graph suffit — l'explorateur affichait son
écran d'erreur et **aucun dossier n'était listé**. La racine étant le seul point
d'entrée de l'arborescence, un throttling passager rendait toute la configuration
impossible, alors qu'avant le Lot 16 cet appel n'existait même pas.

L'identifiant de la racine ne sert qu'à proposer la racine elle-même : son échec
est désormais avalé (`.catch(() => null)`). Le bouton `Choose this folder` reste
estompé à la racine, exactement comme avant le lot, mais la navigation vers les
sous-dossiers continue de fonctionner.

## Contenu du Lot 17

Ce lot ferme un piège et corrige une documentation qui décrivait un mécanisme
jamais écrit.

### Le piège : une configuration acceptée, un tri impossible

L'explorateur laissait choisir un dossier partagé comme destination alors que la
source était dans votre OneDrive. La configuration s'enregistrait sans rien dire,
le bouton `Start sorting` s'activait — et **chaque geste de tri échouait** avec
« OneDrive cannot move a file from one drive to another ». Rien n'indiquait
lequel des six dossiers était fautif, ni comment s'en sortir.

Le refus arrive maintenant **au moment du choix**. `emplacementSurUnAutreDrive`
compare le drive du dossier proposé à celui de tous les emplacements déjà
occupés, et le message nomme celui qui est en conflit :

> “Album de Paul” is on a different OneDrive than “Folder to sort”. OneDrive
> cannot move a file from one drive to another, so every folder must live on the
> same OneDrive. Choose another folder, or clear the other one first.

La comparaison se fait contre **n'importe quel** emplacement occupé et pas
seulement contre la source : les dossiers peuvent être choisis dans l'ordre que
l'on veut, et la source est parfois posée en dernier. L'emplacement que l'on est
en train de remplacer est ignoré, sinon on ne pourrait jamais corriger le premier
dossier choisi.

Une configuration enregistrée avant ce lot pouvait déjà contenir un tel mélange :
`lireConfiguration` la nettoie à la relecture, en gardant le premier dossier
rencontré et en vidant ceux qui vivent ailleurs, comme elle le faisait déjà pour
les doublons.

Ce qui reste permis : trier **entièrement à l'intérieur** d'un dossier partagé.
Ce n'est pas le partage qui gêne, c'est le passage d'un drive à l'autre.

### La documentation : une copie qui n'a jamais existé

Le README annonçait que TriPhoto copierait le fichier
(`POST /drives/{driveId}/items/{id}/copy`) quand la destination était sur un autre
drive, et listait dans ses limitations « l'annulation laisse la copie chez son
propriétaire ». Rien de tout cela n'a jamais été écrit : `deplacerElement` refuse
le déplacement inter-drive **avant même le premier appel réseau**. Aucune copie
n'a donc jamais été créée, et il n'y a rien à nettoyer chez personne.

La section dit maintenant ce que le code fait, et explique pourquoi la copie a
été écartée plutôt que remise à plus tard : elle laisserait justement un doublon
qu'une annulation ne pourrait pas défaire sans supprimer un fichier chez
quelqu'un d'autre.
