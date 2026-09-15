/**
 * Lecture des dossiers OneDrive via Microsoft Graph.
 *
 * Comme pour `/me`, tout est écrit en `fetch` explicite : on voit l'URL appelée,
 * les champs demandés et le code de retour.
 */

export type DossierOneDrive = {
  id: string
  nom: string
  nombreEnfants: number
}

/** Un élément de `children` peut être un fichier ou un dossier. */
type ElementGraph = {
  id?: string
  name?: string
  folder?: { childCount?: number }
}

type ReponseChildren = {
  value?: ElementGraph[]
  '@odata.nextLink'?: string
}

// On ne demande que les champs utilisés : une page de 200 éléments reste légère.
const PARAMETRES = '?$select=id,name,folder&$top=200'

export function listerDossiersRacine(jetonAcces: string): Promise<DossierOneDrive[]> {
  return listerDossiers(jetonAcces, `https://graph.microsoft.com/v1.0/me/drive/root/children${PARAMETRES}`)
}

export function listerSousDossiers(jetonAcces: string, idDossier: string): Promise<DossierOneDrive[]> {
  const id = encodeURIComponent(idDossier)
  return listerDossiers(jetonAcces, `https://graph.microsoft.com/v1.0/me/drive/items/${id}/children${PARAMETRES}`)
}

async function listerDossiers(jetonAcces: string, premiereUrl: string): Promise<DossierOneDrive[]> {
  const dossiers: DossierOneDrive[] = []
  let url: string | undefined = premiereUrl

  // Graph pagine les résultats : tant qu'il renvoie une URL de page suivante,
  // on continue, sinon un dossier de plus de 200 éléments serait tronqué.
  while (url) {
    const reponse = await fetch(url, {
      headers: { Authorization: `Bearer ${jetonAcces}` },
    })

    if (!reponse.ok) {
      throw new Error(`Microsoft Graph a refusé la lecture du dossier (code ${reponse.status}).`)
    }

    const page = (await reponse.json()) as ReponseChildren
    for (const element of page.value ?? []) {
      if (element.folder && element.id && element.name) {
        dossiers.push({
          id: element.id,
          nom: element.name,
          nombreEnfants: element.folder.childCount ?? 0,
        })
      }
    }

    url = page['@odata.nextLink']
  }

  // `numeric` pour que « 2024-2 » précède « 2024-10 » : les dossiers de photos
  // portent presque toujours des noms datés.
  return dossiers.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
}
