/**
 * Déplacement d'un fichier d'un dossier OneDrive à un autre, via Microsoft Graph.
 *
 * TriPhoto ne supprime jamais rien : « Delete » déplace le média vers le dossier
 * Poubelle choisi à la configuration, et « Recover » le ramène dans le dossier
 * à trier. Les deux opérations sont le même appel, avec un parent différent.
 */

import { enTetes } from './dossiers'

/** Dossier d'arrivée : il faut son drive autant que son identifiant. */
export type DestinationDeplacement = {
  driveId: string
  id: string
}

export const MESSAGE_AUTRE_DRIVE =
  'Ce dossier appartient à un autre OneDrive. Microsoft Graph ne sait pas y déplacer ' +
  'un fichier en une seule opération.'

/**
 * Déplace l'élément vers le dossier indiqué. L'identifiant du fichier ne change
 * pas : c'est ce qui permet de l'annuler ensuite en le renvoyant vers son
 * dossier d'origine.
 *
 * Le déplacement d'un drive à un autre est refusé tout de suite, avec un message
 * lisible : `PATCH` ne sait pas le faire, et Graph répondrait par une erreur
 * bien plus obscure.
 */
export async function deplacerElement(
  jetonAcces: string,
  driveId: string,
  idElement: string,
  destination: DestinationDeplacement,
): Promise<void> {
  if (destination.driveId !== driveId) {
    throw new Error(MESSAGE_AUTRE_DRIVE)
  }

  const drive = encodeURIComponent(driveId)
  const element = encodeURIComponent(idElement)
  const url = `https://graph.microsoft.com/v1.0/drives/${drive}/items/${element}`

  const reponse = await fetch(url, {
    method: 'PATCH',
    headers: { ...enTetes(jetonAcces), 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentReference: { id: destination.id } }),
  })

  if (!reponse.ok) {
    throw new Error(`Microsoft Graph a refusé le déplacement (code ${reponse.status}).`)
  }
}
