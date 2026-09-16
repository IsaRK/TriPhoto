/**
 * Lecture des photos et vidéos d'un dossier OneDrive via Microsoft Graph.
 *
 * Même approche que pour les dossiers : du `fetch` explicite, où l'on voit l'URL
 * appelée, les champs demandés et le code de retour.
 */

import { enTetes } from './dossiers'

export type MediaOneDrive = {
  id: string
  /** Drive où se trouve le média : il faudra le citer pour le déplacer. */
  driveId: string
  nom: string
  type: 'image' | 'video'
  /** Date retenue pour l'affichage, ou `null` si aucune n'est exploitable. */
  priseLe: string | null
  /**
   * La même date en millisecondes, calculée une seule fois pour le tri. Vaut 0
   * quand la date est absente ou illisible : un comparateur qui renverrait
   * `NaN` désordonnerait la liste entière, et pas seulement l'élément fautif.
   */
  instantPriseLe: number
  /**
   * URL de téléchargement signée par Graph, ou `null` si Graph ne l'a pas
   * renvoyée. Elle expire au bout d'environ une heure : l'écran de tri devra la
   * redemander pour les longues sessions.
   */
  urlTelechargement: string | null
  /**
   * Miniature affichable, ou `null` si Graph n'en a pas encore produit.
   * Voir `PARAMETRES` pour la taille demandée.
   */
  urlMiniature: string | null
  taille: number
}

type ElementGraph = {
  id?: string
  name?: string
  size?: number
  createdDateTime?: string
  /** Date du fichier sur l'appareil d'origine, conservée par OneDrive à l'envoi. */
  fileSystemInfo?: { createdDateTime?: string }
  file?: { mimeType?: string }
  photo?: { takenDateTime?: string }
  '@microsoft.graph.downloadUrl'?: string
  thumbnails?: { c1600x1600?: { url?: string }; large?: { url?: string } }[]
}

type ReponseChildren = {
  value?: ElementGraph[]
  '@odata.nextLink'?: string
}

/**
 * `$expand=thumbnails` est nécessaire car les miniatures sont une relation, et
 * non un champ : sans lui Graph ne les renvoie pas. On demande l'URL de
 * téléchargement explicitement, sinon le `$select` l'exclurait.
 *
 * On demande une taille sur mesure de 1600 px plutôt que la taille `large` :
 * celle-ci plafonne selon les comptes, et une photo affichée en plein écran sur
 * un téléphone à forte densité paraîtrait floue. `large` reste demandée en
 * secours, car OneDrive ne produit pas toujours les tailles sur mesure.
 *
 * `$top` reste modeste : sur une page trop large, OneDrive renonce à produire
 * les miniatures d'une partie des éléments.
 */
const PARAMETRES =
  '?$select=id,name,file,photo,video,size,createdDateTime,fileSystemInfo,@microsoft.graph.downloadUrl' +
  '&$expand=thumbnails($select=c1600x1600,large)' +
  '&$top=50'

/**
 * Tous les médias du dossier, du plus ancien au plus récent : on trie les photos
 * dans l'ordre où elles ont été prises, ce qui regroupe naturellement les
 * souvenirs d'un même moment.
 */
export async function listerMedias(
  jetonAcces: string,
  driveId: string,
  idDossier: string,
): Promise<MediaOneDrive[]> {
  const drive = encodeURIComponent(driveId)
  const id = encodeURIComponent(idDossier)
  const medias: MediaOneDrive[] = []
  let url: string | undefined = `https://graph.microsoft.com/v1.0/drives/${drive}/items/${id}/children${PARAMETRES}`

  // Graph pagine les résultats : tant qu'il renvoie une URL de page suivante, on
  // continue, sinon un dossier de plus de 200 éléments serait tronqué.
  while (url) {
    const reponse = await fetch(url, { headers: enTetes(jetonAcces) })

    if (!reponse.ok) {
      throw new Error(`Microsoft Graph a refusé la lecture des médias (code ${reponse.status}).`)
    }

    const page = (await reponse.json()) as ReponseChildren
    for (const element of page.value ?? []) {
      const media = convertir(element, driveId)
      if (media) {
        medias.push(media)
      }
    }

    url = page['@odata.nextLink']
  }

  return medias.sort((a, b) => a.instantPriseLe - b.instantPriseLe)
}

/**
 * Traduit un élément Graph en média utilisable, ou `undefined` si ce n'en est
 * pas un : les dossiers et les documents sont écartés ici plutôt qu'au moment
 * de l'affichage.
 *
 * Un média dont Graph n'a pas renvoyé l'URL de téléchargement est conservé :
 * l'écarter ferait passer un dossier plein pour un dossier vide, sans le
 * moindre message.
 */
function convertir(element: ElementGraph, driveId: string): MediaOneDrive | undefined {
  const type = typeDuFichier(element.file?.mimeType)

  if (!type || !element.id || !element.name) {
    return undefined
  }

  const priseLe = datePriseDeVue(element)
  const instant = priseLe === null ? Number.NaN : Date.parse(priseLe)

  return {
    id: element.id,
    driveId,
    nom: element.name,
    type,
    priseLe,
    instantPriseLe: Number.isNaN(instant) ? 0 : instant,
    urlTelechargement: element['@microsoft.graph.downloadUrl'] ?? null,
    urlMiniature:
      element.thumbnails?.[0]?.c1600x1600?.url ?? element.thumbnails?.[0]?.large?.url ?? null,
    taille: element.size ?? 0,
  }
}

function typeDuFichier(mimeType: string | undefined): 'image' | 'video' | undefined {
  if (mimeType?.startsWith('image/')) {
    return 'image'
  }
  if (mimeType?.startsWith('video/')) {
    return 'video'
  }
  return undefined
}

/**
 * Date de prise de vue de l'appareil photo, sinon date du fichier sur
 * l'appareil d'origine, sinon date d'ajout dans OneDrive.
 *
 * `photo.takenDateTime` n'existe que pour les images issues d'un appareil
 * photo : ni les captures d'écran, ni les vidéos n'en ont. Pour celles-là,
 * `fileSystemInfo.createdDateTime` reste proche du moment réel, alors que
 * `createdDateTime` n'est que la date d'envoi vers OneDrive — elle regrouperait
 * toutes les vidéos au jour où l'appareil a été branché.
 */
function datePriseDeVue(element: ElementGraph): string | null {
  return (
    element.photo?.takenDateTime ??
    element.fileSystemInfo?.createdDateTime ??
    element.createdDateTime ??
    null
  )
}
