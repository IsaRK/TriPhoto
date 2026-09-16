/**
 * Appel Microsoft Graph `GET /me`.
 *
 * Volontairement écrit avec `fetch` et sans SDK : une requête HTTP explicite,
 * dont on voit l'URL, l'en-tête d'autorisation et le code de retour.
 */

export type ProfilUtilisateur = {
  nom: string
  /** Adresse du compte. `null` quand Graph ne la renvoie pas. */
  email: string | null
}

type ReponseGraphMe = {
  displayName?: string
  givenName?: string
  mail?: string | null
  userPrincipalName?: string | null
}

/**
 * Les champs sont demandés explicitement. Sur un compte Microsoft personnel,
 * `mail` est souvent vide alors que `userPrincipalName` porte bien l'adresse
 * saisie à la connexion : il faut donc les deux.
 */
const URL_PROFIL =
  'https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,mail,userPrincipalName'

export async function recupererProfil(jetonAcces: string): Promise<ProfilUtilisateur> {
  const reponse = await fetch(URL_PROFIL, {
    headers: { Authorization: `Bearer ${jetonAcces}` },
  })

  if (!reponse.ok) {
    throw new Error(`Microsoft Graph a refusé la requête /me (code ${reponse.status}).`)
  }

  const donnees = (await reponse.json()) as ReponseGraphMe
  return {
    nom: donnees.displayName ?? donnees.givenName ?? 'Compte Microsoft',
    email: donnees.mail ?? donnees.userPrincipalName ?? null,
  }
}
