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

Copier `.env.example` vers `.env.local` et y renseigner `VITE_MSAL_CLIENT_ID`
(la variable ne sera utilisée qu'à partir du Lot 1).

## État d'avancement

| Lot | Périmètre | Statut |
| --- | --- | --- |
| Lot 0 | Fondations : Vite + React + TypeScript, thème et palette, routage, Vitest | ✅ Terminé |
| Lot 1 | Authentification Microsoft (MSAL, comptes personnels) | ⏳ À venir |
| Lots suivants | Explorateur de dossiers OneDrive, listage des médias, gestes de swipe, déplacements Graph, annulation, PWA, README complet | ⏳ À venir |

### Contenu du Lot 0

- Coquille Vite + React + TypeScript en `strict: true`
- Thème CSS avec la palette (orange `#FFA530`, vert d'eau `#50ACA2`, bleu `#405885`,
  rose `#E0748B`, fond `#F7F5F2`) et layout mobile plein écran (`100dvh`, `viewport-fit=cover`)
- Table des directions de swipe (`src/tri/directions.ts`), source de vérité unique des
  couleurs associées à chaque direction : gauche → bleu, droite → orange,
  haut → vert d'eau, bas → rose
- Routage `react-router-dom` : `/` (accueil / configuration) et `/tri`
- Tests Vitest + Testing Library (routage et cohérence des directions)

Aucune fonctionnalité métier n'est encore implémentée : pas de connexion Microsoft,
pas d'accès OneDrive, pas de gestes de swipe.
