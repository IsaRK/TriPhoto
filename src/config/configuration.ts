import type { DirectionSwipe } from '../tri/directions'

/** Ce que l'explorateur sait produire : un dossier OneDrive, sans titre court. */
export type DossierChoisi = {
  id: string
  /** Drive propriétaire du dossier : le nôtre, ou celui d'un dossier partagé. */
  driveId: string
  nom: string
  /** Chemin lisible affiché à l'utilisateur, ex. « OneDrive / Photos / 2024 ». */
  chemin: string
}

/**
 * Un dossier posé sur un emplacement. Il ajoute au dossier choisi un titre
 * court, que l'écran de tri affichera à côté de chaque direction : un chemin
 * complet serait illisible sur une carte en plein écran.
 */
export type DossierConfigure = DossierChoisi & {
  titre: string
}

/** Un titre plus long ne tiendrait pas à côté d'une direction sur un écran de téléphone. */
export const TITRE_LONGUEUR_MAX = 10

/**
 * Les six emplacements configurables. Les quatre destinations portent ici le
 * même nom que dans la table des directions de swipe, ce qui évite d'entretenir
 * une correspondance entre les deux.
 */
export type Emplacement = 'source' | DirectionSwipe | 'poubelle'

export type Configuration = {
  source: DossierConfigure | null
  gauche: DossierConfigure | null
  droite: DossierConfigure | null
  haut: DossierConfigure | null
  bas: DossierConfigure | null
  poubelle: DossierConfigure | null
}

export const EMPLACEMENTS: readonly Emplacement[] = [
  'source',
  'gauche',
  'droite',
  'haut',
  'bas',
  'poubelle',
]

export const CONFIGURATION_VIDE: Configuration = {
  source: null,
  gauche: null,
  droite: null,
  haut: null,
  bas: null,
  poubelle: null,
}

const CLE_STOCKAGE = 'triphoto.configuration'

/**
 * Relit la configuration sauvegardée. Tout ce qui n'a pas exactement la forme
 * attendue est ignoré plutôt que de faire planter l'écran de tri : le contenu
 * du localStorage peut venir d'une version précédente ou avoir été modifié à la
 * main.
 */
export function lireConfiguration(): Configuration {
  const brut = lireTexteStocke()
  if (brut === null) {
    return CONFIGURATION_VIDE
  }

  let donnees: unknown
  try {
    donnees = JSON.parse(brut)
  } catch {
    return CONFIGURATION_VIDE
  }

  if (typeof donnees !== 'object' || donnees === null) {
    return CONFIGURATION_VIDE
  }

  const champs = donnees as Record<string, unknown>
  const configuration = { ...CONFIGURATION_VIDE }
  for (const emplacement of EMPLACEMENTS) {
    configuration[emplacement] = validerDossier(champs[emplacement])
  }
  return retirerLesDoublons(configuration)
}

/**
 * Enregistre la configuration. Renvoie `false` si le navigateur a refusé
 * d'écrire (navigation privée, stockage plein) : l'appelant doit le dire à
 * l'utilisateur, sinon ses choix disparaîtraient au rechargement sans qu'il
 * comprenne pourquoi.
 */
export function ecrireConfiguration(configuration: Configuration): boolean {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(configuration))
    return true
  } catch {
    return false
  }
}

export function definirDossier(
  configuration: Configuration,
  emplacement: Emplacement,
  dossier: DossierConfigure,
): Configuration {
  return { ...configuration, [emplacement]: dossier }
}

/**
 * Enregistre le titre en cours de frappe. On se contente de couper à la
 * longueur maximale : corriger le texte à chaque caractère empêcherait de vider
 * le champ pour le retaper, ou d'y saisir une espace.
 */
export function definirTitre(
  configuration: Configuration,
  emplacement: Emplacement,
  titre: string,
): Configuration {
  const dossier = configuration[emplacement]
  if (dossier === null) {
    return configuration
  }
  return {
    ...configuration,
    [emplacement]: { ...dossier, titre: couperTitre(titre) },
  }
}

/**
 * À la sortie du champ : un titre vide ou fait d'espaces repart du nom du
 * dossier, pour ne pas laisser une étiquette vide sur l'écran de tri.
 */
export function normaliserTitre(
  configuration: Configuration,
  emplacement: Emplacement,
): Configuration {
  const dossier = configuration[emplacement]
  if (dossier === null) {
    return configuration
  }
  const titre = dossier.titre.trim()
  return {
    ...configuration,
    [emplacement]: {
      ...dossier,
      titre: titre === '' ? titreParDefaut(dossier.nom) : titre,
    },
  }
}

/** Titre proposé au moment du choix : le nom du dossier, raccourci si besoin. */
export function titreParDefaut(nom: string): string {
  const titre = couperTitre(nom.trim()).trim()
  return titre === '' ? 'Folder' : titre
}

/**
 * Coupe à la longueur maximale en comptant les caractères affichés et non les
 * unités UTF-16 : `slice` couperait un emoji en deux moitiés illisibles.
 */
function couperTitre(texte: string): string {
  return [...texte].slice(0, TITRE_LONGUEUR_MAX).join('')
}

export function retirerDossier(
  configuration: Configuration,
  emplacement: Emplacement,
): Configuration {
  return { ...configuration, [emplacement]: null }
}

/**
 * Cherche si ce dossier est déjà utilisé ailleurs, et renvoie l'emplacement qui
 * l'occupe. Le même dossier en source et en destination ferait tourner le tri
 * en rond : le média reviendrait dans la liste à trier après chaque geste.
 */
export function emplacementDejaUtilise(
  configuration: Configuration,
  emplacementVise: Emplacement,
  dossier: DossierChoisi,
): Emplacement | null {
  for (const emplacement of EMPLACEMENTS) {
    if (emplacement === emplacementVise) {
      continue
    }
    const occupant = configuration[emplacement]
    if (occupant !== null && occupant.id === dossier.id && occupant.driveId === dossier.driveId) {
      return emplacement
    }
  }
  return null
}

/**
 * Le tri demande le dossier à trier, le dossier Poubelle et au moins une
 * destination : sans poubelle, le bouton Supprimer de l'écran de tri n'aurait
 * nulle part où envoyer les médias.
 */
export function peutCommencerLeTri(configuration: Configuration): boolean {
  return (
    configuration.source !== null &&
    configuration.poubelle !== null &&
    compterDestinations(configuration) > 0
  )
}

export function compterDestinations(configuration: Configuration): number {
  return [configuration.gauche, configuration.droite, configuration.haut, configuration.bas].filter(
    (dossier) => dossier !== null,
  ).length
}

function lireTexteStocke(): string | null {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE)
  } catch {
    return null
  }
}

function validerDossier(valeur: unknown): DossierConfigure | null {
  if (typeof valeur !== 'object' || valeur === null) {
    return null
  }
  const { id, driveId, nom, chemin, titre } = valeur as Record<string, unknown>
  if (!estTexteRempli(id) || !estTexteRempli(driveId)) {
    return null
  }
  if (!estTexteRempli(nom) || !estTexteRempli(chemin)) {
    return null
  }
  // Une configuration peut arriver ici sans titre utilisable : soit elle a été
  // enregistrée avant l'existence des titres courts, soit le champ a été laissé
  // vide en cours de frappe. Dans les deux cas on la complète plutôt que de la
  // jeter, sinon un rechargement ferait perdre les dossiers déjà choisis.
  const titreLu = estTexteRempli(titre) ? couperTitre(titre).trim() : ''
  return {
    id,
    driveId,
    nom,
    chemin,
    titre: titreLu === '' ? titreParDefaut(nom) : titreLu,
  }
}

/** `valeur is string` indique au compilateur que la valeur est une chaîne après cet appel. */
function estTexteRempli(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur !== ''
}

/**
 * Vide les emplacements qui désignent un dossier déjà rencontré, le premier de
 * `EMPLACEMENTS` gardant le dossier. L'interface empêche déjà d'affecter deux
 * fois le même dossier, mais pas un localStorage modifié à la main : une source
 * qui serait aussi une destination ferait tourner le tri en rond.
 */
function retirerLesDoublons(configuration: Configuration): Configuration {
  const dejaVus: string[] = []
  const resultat = { ...configuration }

  for (const emplacement of EMPLACEMENTS) {
    const dossier = resultat[emplacement]
    if (dossier === null) {
      continue
    }
    const cle = `${dossier.driveId}/${dossier.id}`
    if (dejaVus.includes(cle)) {
      resultat[emplacement] = null
    } else {
      dejaVus.push(cle)
    }
  }

  return resultat
}
