/**
 * Lecture des dossiers OneDrive via Microsoft Graph.
 *
 * Comme pour `/me`, tout est écrit en `fetch` explicite : on voit l'URL appelée,
 * les champs demandés et le code de retour.
 */

export type DossierOneDrive = {
  id: string
  /** Drive auquel appartient le dossier : le nôtre, ou celui d'une personne qui partage. */
  driveId: string
  nom: string
  nombreEnfants: number
  partage: boolean
}

/**
 * Un élément de `children` peut être un fichier, un dossier, ou un raccourci vers
 * un dossier partagé (« Ajouter à mon OneDrive »). Dans ce dernier cas l'élément
 * n'a pas de facette `folder` : c'est `remoteItem` qui décrit le vrai dossier.
 */
type ElementGraph = {
  id?: string
  name?: string
  folder?: { childCount?: number }
  remoteItem?: {
    id?: string
    folder?: { childCount?: number }
    parentReference?: { driveId?: string }
  }
}

type ReponseChildren = {
  value?: ElementGraph[]
  '@odata.nextLink'?: string
}

// On ne demande que les champs utilisés : une page de 200 éléments reste légère.
const PARAMETRES = '?$select=id,name,folder,remoteItem&$top=200'

let idMonDriveMemorise: string | undefined

/**
 * Identifiant de notre propre drive. Il ne sert pas à construire les URL mais à
 * reconnaître les dossiers qui ne sont pas chez nous : c'est cette distinction qui
 * décidera, au moment du tri, entre un déplacement et une copie.
 *
 * Il ne change jamais pour un compte donné : on ne le demande qu'une fois.
 */
export async function lireIdDeMonDrive(jetonAcces: string): Promise<string> {
  if (idMonDriveMemorise) {
    return idMonDriveMemorise
  }

  const reponse = await fetch('https://graph.microsoft.com/v1.0/me/drive?$select=id', {
    headers: enTetes(jetonAcces),
  })

  if (!reponse.ok) {
    throw new Error(`Microsoft Graph a refusé la lecture de votre OneDrive (code ${reponse.status}).`)
  }

  const drive = (await reponse.json()) as { id?: string }
  if (!drive.id) {
    throw new Error('Microsoft Graph n’a pas renvoyé l’identifiant de votre OneDrive.')
  }

  idMonDriveMemorise = drive.id
  return drive.id
}

/** Réservé aux tests : repart d'un module vierge. */
export function oublierIdDeMonDrive(): void {
  idMonDriveMemorise = undefined
}

export async function listerDossiersRacine(jetonAcces: string): Promise<DossierOneDrive[]> {
  const idMonDrive = await lireIdDeMonDrive(jetonAcces)
  return listerDossiers(
    jetonAcces,
    `https://graph.microsoft.com/v1.0/me/drive/root/children${PARAMETRES}`,
    idMonDrive,
    idMonDrive,
  )
}

export async function listerSousDossiers(
  jetonAcces: string,
  driveId: string,
  idDossier: string,
): Promise<DossierOneDrive[]> {
  const idMonDrive = await lireIdDeMonDrive(jetonAcces)
  const drive = encodeURIComponent(driveId)
  const id = encodeURIComponent(idDossier)
  return listerDossiers(
    jetonAcces,
    `https://graph.microsoft.com/v1.0/drives/${drive}/items/${id}/children${PARAMETRES}`,
    driveId,
    idMonDrive,
  )
}

async function listerDossiers(
  jetonAcces: string,
  premiereUrl: string,
  driveIdCourant: string,
  idMonDrive: string,
): Promise<DossierOneDrive[]> {
  const dossiers: DossierOneDrive[] = []
  let url: string | undefined = premiereUrl

  // Graph pagine les résultats : tant qu'il renvoie une URL de page suivante,
  // on continue, sinon un dossier de plus de 200 éléments serait tronqué.
  while (url) {
    const reponse = await fetch(url, {
      headers: enTetes(jetonAcces),
    })

    if (!reponse.ok) {
      throw new Error(`Microsoft Graph a refusé la lecture du dossier (code ${reponse.status}).`)
    }

    const page = (await reponse.json()) as ReponseChildren
    for (const element of page.value ?? []) {
      const dossier = convertir(element, driveIdCourant, idMonDrive)
      if (dossier) {
        dossiers.push(dossier)
      }
    }

    url = page['@odata.nextLink']
  }

  // `numeric` pour que « 2024-2 » précède « 2024-10 » : les dossiers de photos
  // portent presque toujours des noms datés.
  return dossiers.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }))
}

/**
 * Traduit un élément Graph en dossier utilisable, ou `undefined` si ce n'en est
 * pas un. Un raccourci vers un dossier partagé est rendu par le vrai dossier
 * distant : c'est lui qu'il faudra lire et alimenter ensuite.
 *
 * `partage` répond à « ce dossier n'est pas dans mon drive », et reste donc vrai
 * pour tous les sous-dossiers d'un album partagé, pas seulement pour le raccourci.
 */
function convertir(
  element: ElementGraph,
  driveIdCourant: string,
  idMonDrive: string,
): DossierOneDrive | undefined {
  const distant = element.remoteItem
  if (distant?.folder) {
    const driveId = distant.parentReference?.driveId
    if (!distant.id || !driveId || !element.name) {
      return undefined
    }
    return {
      id: distant.id,
      driveId,
      nom: element.name,
      nombreEnfants: distant.folder.childCount ?? 0,
      partage: driveId !== idMonDrive,
    }
  }

  if (element.folder && element.id && element.name) {
    return {
      id: element.id,
      driveId: driveIdCourant,
      nom: element.name,
      nombreEnfants: element.folder.childCount ?? 0,
      partage: driveIdCourant !== idMonDrive,
    }
  }

  return undefined
}

/** En-tête commun à tous les appels Graph. */
export function enTetes(jetonAcces: string): HeadersInit {
  return { Authorization: `Bearer ${jetonAcces}` }
}
