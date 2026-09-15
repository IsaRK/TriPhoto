import type { DirectionSwipe } from '../tri/directions'

/** Un dossier OneDrive retenu dans la configuration. */
export type DossierConfigure = {
  id: string
  /** Drive propriétaire du dossier : le nôtre, ou celui d'un dossier partagé. */
  driveId: string
  nom: string
  /** Chemin lisible affiché à l'utilisateur, ex. « OneDrive / Photos / 2024 ». */
  chemin: string
}

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

export function effacerConfiguration(): void {
  try {
    window.localStorage.removeItem(CLE_STOCKAGE)
  } catch {
    // Rien à signaler : l'utilisateur voulait justement se débarrasser de ces
    // choix, et ils ont bien disparu de l'écran.
  }
}

export function definirDossier(
  configuration: Configuration,
  emplacement: Emplacement,
  dossier: DossierConfigure,
): Configuration {
  return { ...configuration, [emplacement]: dossier }
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
  dossier: DossierConfigure,
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

/** Le tri demande un dossier source et au moins une destination. */
export function peutCommencerLeTri(configuration: Configuration): boolean {
  return configuration.source !== null && compterDestinations(configuration) > 0
}

export function compterDestinations(configuration: Configuration): number {
  return [configuration.gauche, configuration.droite, configuration.haut, configuration.bas].filter(
    (dossier) => dossier !== null,
  ).length
}

export function estConfigurationVide(configuration: Configuration): boolean {
  return EMPLACEMENTS.every((emplacement) => configuration[emplacement] === null)
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
  const { id, driveId, nom, chemin } = valeur as Record<string, unknown>
  if (!estTexteRempli(id) || !estTexteRempli(driveId)) {
    return null
  }
  if (!estTexteRempli(nom) || !estTexteRempli(chemin)) {
    return null
  }
  return { id, driveId, nom, chemin }
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
