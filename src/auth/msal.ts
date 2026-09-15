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

export const SCOPES = ['User.Read', 'Files.ReadWrite']

export const MESSAGE_CLIENT_ID_MANQUANT =
  "La variable VITE_MSAL_CLIENT_ID n'est pas renseignée. " +
  'Créez une app registration Entra (comptes Microsoft personnels uniquement, ' +
  'plateforme « Single-page application », URI de redirection http://localhost:5173), ' +
  'puis copiez son Client ID dans un fichier .env.local à la racine du projet sous la ' +
  'forme VITE_MSAL_CLIENT_ID=... et relancez `npm run dev`. ' +
  'La marche à suivre détaillée est dans le README.'

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
      // L'URI de redirection suit l'origine courante : localhost en dev, l'URL de
      // production une fois déployé. Les deux doivent être déclarées dans l'app
      // registration.
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
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
