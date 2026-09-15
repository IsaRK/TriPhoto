/**
 * Appel Microsoft Graph `GET /me`.
 *
 * Volontairement écrit avec `fetch` et sans SDK : une requête HTTP explicite,
 * dont on voit l'URL, l'en-tête d'autorisation et le code de retour.
 */

export type ProfilUtilisateur = {
  nom: string
}

type ReponseGraphMe = {
  displayName?: string
  givenName?: string
}

export async function recupererProfil(jetonAcces: string): Promise<ProfilUtilisateur> {
  const reponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${jetonAcces}` },
  })

  if (!reponse.ok) {
    throw new Error(`Microsoft Graph a refusé la requête /me (code ${reponse.status}).`)
  }

  const donnees = (await reponse.json()) as ReponseGraphMe
  return {
    nom: donnees.displayName ?? donnees.givenName ?? 'Compte Microsoft',
  }
}
