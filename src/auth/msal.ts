import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'
import type { AccountInfo, Configuration, IPublicClientApplication } from '@azure/msal-browser'

/**
 * Configuration MSAL de TriPhoto.
 *
 * Authority `/consumers` : seuls les comptes Microsoft personnels (outlook.com,
 * hotmail.com, live.fr…) sont acceptés, pas les comptes professionnels.
 *
 * On utilise le flux par *redirection* et non par popup : sur navigateur mobile
 * (l'usage principal de l'app), les popups sont souvent bloquées ou s'ouvrent
 * dans un onglet séparé que l'utilisateur doit refermer à la main.
 */

/**
 * `Files.ReadWrite` couvre notre propre OneDrive. `Files.ReadWrite.All` l'élargit
 * aux dossiers partagés par d'autres personnes, qui vivent dans leur drive à eux.
 */
export const SCOPES = ['User.Read', 'Files.ReadWrite', 'Files.ReadWrite.All']

export const MESSAGE_CLIENT_ID_MANQUANT =
  'The VITE_MSAL_CLIENT_ID variable is not set. ' +
  'Create an Entra app registration (personal Microsoft accounts only, ' +
  '“Single-page application” platform, redirect URI http://localhost:5173), ' +
  'then copy its Client ID into a .env.local file at the root of the project as ' +
  'VITE_MSAL_CLIENT_ID=... and restart `npm run dev`. ' +
  'The detailed procedure is in the README.'

/**
 * Adresse à laquelle Microsoft doit nous renvoyer après la connexion.
 *
 * Ce n'est pas simplement l'origine du site : sur GitHub Pages, l'application
 * vit dans un sous-dossier (`https://isark.github.io/TriPhoto/`). Renvoyer vers
 * la seule origine aboutirait à la page d'accueil du compte GitHub, hors de
 * l'application, et Entra refuserait de toute façon une URI qu'il ne connaît pas.
 *
 * En développement, `BASE_URL` vaut « / » : on retourne alors l'origine seule,
 * sans barre oblique finale, car Entra compare les URI caractère par caractère
 * et c'est `http://localhost:5173` qui est déclaré dans l'app registration.
 */
export function calculerRedirectUri(
  base: string = import.meta.env.BASE_URL,
  origine: string = window.location.origin,
): string {
  if (base === '/') {
    return origine
  }
  return origine + base
}

export function lireClientId(): string {
  const clientId = import.meta.env.VITE_MSAL_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error(MESSAGE_CLIENT_ID_MANQUANT)
  }
  return clientId
}

export function creerConfiguration(clientId: string): Configuration {
  return {
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/consumers',
      // L'URI de redirection suit l'adresse par laquelle on est arrivé : localhost
      // en développement, l'URL de production une fois déployé. Les deux doivent
      // être déclarées dans l'app registration.
      redirectUri: calculerRedirectUri(),
      postLogoutRedirectUri: calculerRedirectUri(),
    },
    cache: {
      // localStorage (et non sessionStorage) pour rester connecté d'une session à
      // l'autre, ce qui compte pour une app ajoutée à l'écran d'accueil.
      cacheLocation: 'localStorage',
    },
  }
}

// Une seule instance MSAL pour toute la durée de vie de la page. La promesse est
// mémorisée ici et non dans un composant : en développement, React monte les
// effets deux fois, ce qui créerait deux instances concurrentes se disputant le
// même code d'autorisation au retour de redirection.
let instanceMemorisee: Promise<IPublicClientApplication> | undefined

/**
 * Crée l'instance MSAL, termine le retour de redirection éventuel et désigne le
 * compte actif. Appelable plusieurs fois : le travail n'est fait qu'une fois.
 */
export function creerInstanceMsal(): Promise<IPublicClientApplication> {
  instanceMemorisee ??= construireInstanceMsal().catch((erreur: unknown) => {
    // On oublie une initialisation ratée pour qu'un nouvel essai reparte de zéro.
    instanceMemorisee = undefined
    throw erreur
  })
  return instanceMemorisee
}

/** Oublie l'instance mémorisée. Utilisé par les tests pour repartir d'un état neuf. */
export function oublierInstanceMsal(): void {
  instanceMemorisee = undefined
}

async function construireInstanceMsal(): Promise<IPublicClientApplication> {
  const instance = new PublicClientApplication(creerConfiguration(lireClientId()))
  await instance.initialize()
  await instance.handleRedirectPromise()

  const comptes = instance.getAllAccounts()
  const premierCompte = comptes[0]
  if (!instance.getActiveAccount() && premierCompte) {
    instance.setActiveAccount(premierCompte)
  }

  return instance
}

/** Récupère un jeton d'accès Graph pour le compte connecté. */
export async function recupererJetonAcces(
  instance: IPublicClientApplication,
  compte: AccountInfo,
): Promise<string> {
  const resultat = await instance.acquireTokenSilent({ scopes: SCOPES, account: compte })
  return resultat.accessToken
}

/**
 * Vrai quand MSAL ne peut plus renouveler le jeton tout seul : il faut repasser
 * par une connexion. On ne redirige jamais automatiquement dans ce cas, sinon une
 * cause persistante (consentement retiré) enchaînerait les redirections en boucle.
 */
export function estInteractionRequise(erreur: unknown): boolean {
  return erreur instanceof InteractionRequiredAuthError
}
