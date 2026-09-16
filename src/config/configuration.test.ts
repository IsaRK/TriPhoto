import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration, DossierConfigure } from './configuration'
import {
  CONFIGURATION_VIDE,
  EMPLACEMENTS,
  compterDestinations,
  definirDossier,
  definirTitre,
  ecrireConfiguration,
  emplacementDejaUtilise,
  lireConfiguration,
  normaliserTitre,
  peutCommencerLeTri,
  retirerDossier,
  titreParDefaut,
} from './configuration'

const CLE = 'triphoto.configuration'

function dossier(id: string, driveId = 'mon-drive'): DossierConfigure {
  return {
    id,
    driveId,
    nom: `Dossier ${id}`,
    chemin: `OneDrive / Dossier ${id}`,
    titre: `Dossier ${id}`.slice(0, 10),
  }
}

function dossierSansTitre(id: string, nom: string) {
  return { id, driveId: 'mon-drive', nom, chemin: `OneDrive / ${nom}` }
}

function configurationAvec(champs: Partial<Configuration>): Configuration {
  return { ...CONFIGURATION_VIDE, ...champs }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('persistance de la configuration', () => {
  it('renvoie une configuration vide quand rien n’est enregistré', () => {
    expect(lireConfiguration()).toEqual(CONFIGURATION_VIDE)
  })

  it('relit une configuration enregistrée', () => {
    const configuration = configurationAvec({
      source: dossier('a'),
      gauche: dossier('b'),
    })

    ecrireConfiguration(configuration)

    expect(lireConfiguration()).toEqual(configuration)
  })

  it('ignore un contenu qui n’est pas du JSON', () => {
    window.localStorage.setItem(CLE, 'ceci nest pas du json')

    expect(lireConfiguration()).toEqual(CONFIGURATION_VIDE)
  })

  it('ignore un dossier auquel il manque le driveId', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        source: { id: 'a', nom: 'Photos', chemin: 'OneDrive / Photos' },
      }),
    )

    expect(lireConfiguration().source).toBeNull()
  })

  it('conserve les emplacements valides quand un autre est corrompu', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({ source: dossier('a'), gauche: 'nimporte quoi' }),
    )

    const configuration = lireConfiguration()

    expect(configuration.source).toEqual(dossier('a'))
    expect(configuration.gauche).toBeNull()
  })

  it('ignore un dossier dont le chemin est vide', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        source: { id: 'a', driveId: 'mon-drive', nom: 'Photos', chemin: '' },
      }),
    )

    expect(lireConfiguration().source).toBeNull()
  })

  it('vide le second emplacement quand le stockage contient deux fois le même dossier', () => {
    window.localStorage.setItem(CLE, JSON.stringify({ source: dossier('a'), gauche: dossier('a') }))

    const configuration = lireConfiguration()

    expect(configuration.source).toEqual(dossier('a'))
    expect(configuration.gauche).toBeNull()
  })

  it('renvoie une configuration vide quand le stockage est inaccessible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage refusé')
    })

    expect(lireConfiguration()).toEqual(CONFIGURATION_VIDE)
  })

  it('ne remonte pas d’erreur quand le stockage refuse d’écrire', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage plein')
    })

    expect(ecrireConfiguration(configurationAvec({ source: dossier('a') }))).toBe(false)
  })

  it('confirme l’enregistrement quand le stockage fonctionne', () => {
    expect(ecrireConfiguration(configurationAvec({ source: dossier('a') }))).toBe(true)
  })

  it('énumère exactement les emplacements du type Configuration', () => {
    expect([...EMPLACEMENTS]).toEqual(Object.keys(CONFIGURATION_VIDE))
  })
})

describe('modification de la configuration', () => {
  it('place un dossier sur un emplacement sans toucher aux autres', () => {
    const depart = configurationAvec({ source: dossier('a') })

    const apres = definirDossier(depart, 'droite', dossier('b'))

    expect(apres.droite).toEqual(dossier('b'))
    expect(apres.source).toEqual(dossier('a'))
  })

  it('retire un dossier d’un emplacement', () => {
    const depart = configurationAvec({ haut: dossier('a') })

    expect(retirerDossier(depart, 'haut').haut).toBeNull()
  })

  it('ne modifie pas la configuration d’origine', () => {
    const depart = configurationAvec({ source: dossier('a') })

    definirDossier(depart, 'bas', dossier('b'))

    expect(depart.bas).toBeNull()
  })
})

describe('titres courts des directions', () => {
  it('reprend le nom du dossier comme titre par défaut', () => {
    expect(titreParDefaut('Vacances')).toBe('Vacances')
  })

  it('coupe un nom trop long et ne laisse pas d’espace en fin de titre', () => {
    expect(titreParDefaut('Photos de famille')).toBe('Photos de')
  })

  it('ne coupe jamais au-delà de la longueur maximale', () => {
    expect(titreParDefaut('Anniversaires')).toBe('Anniversai')
  })

  it('ne coupe pas un emoji en deux', () => {
    expect(titreParDefaut('Vacances 📸2024')).toBe('Vacances 📸')
  })

  it('propose un titre lisible quand le nom ne donne rien', () => {
    expect(titreParDefaut('   ')).toBe('Dossier')
  })

  it('coupe la saisie à la longueur maximale', () => {
    const depart = configurationAvec({ gauche: dossier('a') })

    const apres = definirTitre(depart, 'gauche', 'abcdefghijklmnop')

    expect(apres.gauche?.titre).toBe('abcdefghij')
  })

  it('laisse saisir un titre vide sans le remplacer pendant la frappe', () => {
    const depart = configurationAvec({ gauche: dossier('a') })

    const apres = definirTitre(depart, 'gauche', '')

    expect(apres.gauche?.titre).toBe('')
  })

  it('remplace un titre laissé vide par le titre par défaut', () => {
    const depart = definirTitre(configurationAvec({ gauche: dossier('a') }), 'gauche', '   ')

    const apres = normaliserTitre(depart, 'gauche')

    expect(apres.gauche?.titre).toBe(titreParDefaut('Dossier a'))
  })

  it('conserve un titre renseigné en retirant les espaces autour', () => {
    const depart = definirTitre(configurationAvec({ haut: dossier('a') }), 'haut', ' Été ')

    const apres = normaliserTitre(depart, 'haut')

    expect(apres.haut?.titre).toBe('Été')
  })

  it('ne renomme pas un emplacement vide', () => {
    const apres = definirTitre(CONFIGURATION_VIDE, 'bas', 'Perso')

    expect(apres.bas).toBeNull()
  })

  it('ne normalise pas un emplacement vide', () => {
    const apres = normaliserTitre(CONFIGURATION_VIDE, 'bas')

    expect(apres.bas).toBeNull()
  })

  it('complète une configuration enregistrée avant l’arrivée des titres', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        source: dossierSansTitre('s', 'Pellicule'),
        gauche: dossierSansTitre('g', 'Vacances'),
        droite: dossierSansTitre('d', 'Famille'),
        haut: dossierSansTitre('h', 'Souvenirs'),
        bas: dossierSansTitre('b', 'Documents administratifs'),
        poubelle: dossierSansTitre('p', 'A supprimer'),
      }),
    )

    const relue = lireConfiguration()

    expect(relue).toEqual({
      source: {
        id: 's',
        driveId: 'mon-drive',
        nom: 'Pellicule',
        chemin: 'OneDrive / Pellicule',
        titre: 'Pellicule',
      },
      gauche: {
        id: 'g',
        driveId: 'mon-drive',
        nom: 'Vacances',
        chemin: 'OneDrive / Vacances',
        titre: 'Vacances',
      },
      droite: {
        id: 'd',
        driveId: 'mon-drive',
        nom: 'Famille',
        chemin: 'OneDrive / Famille',
        titre: 'Famille',
      },
      haut: {
        id: 'h',
        driveId: 'mon-drive',
        nom: 'Souvenirs',
        chemin: 'OneDrive / Souvenirs',
        titre: 'Souvenirs',
      },
      bas: {
        id: 'b',
        driveId: 'mon-drive',
        nom: 'Documents administratifs',
        chemin: 'OneDrive / Documents administratifs',
        titre: 'Documents',
      },
      poubelle: {
        id: 'p',
        driveId: 'mon-drive',
        nom: 'A supprimer',
        chemin: 'OneDrive / A supprimer',
        titre: 'A supprime',
      },
    })
  })

  it('répare un titre laissé vide dans le stockage', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        ...CONFIGURATION_VIDE,
        gauche: { ...dossierSansTitre('g', 'Vacances'), titre: '' },
      }),
    )

    expect(lireConfiguration().gauche?.titre).toBe('Vacances')
  })

  it('répare un titre fait d’espaces dans le stockage', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        ...CONFIGURATION_VIDE,
        gauche: { ...dossierSansTitre('g', 'Vacances'), titre: '   ' },
      }),
    )

    expect(lireConfiguration().gauche?.titre).toBe('Vacances')
  })

  it('répare un titre qui n’est pas du texte dans le stockage', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        ...CONFIGURATION_VIDE,
        gauche: { ...dossierSansTitre('g', 'Vacances'), titre: 42 },
      }),
    )

    expect(lireConfiguration().gauche?.titre).toBe('Vacances')
  })

  it('raccourcit un titre trop long trouvé dans le stockage', () => {
    window.localStorage.setItem(
      CLE,
      JSON.stringify({
        ...CONFIGURATION_VIDE,
        gauche: {
          ...dossierSansTitre('g', 'Vacances'),
          titre: 'beaucoup trop long',
        },
      }),
    )

    expect(lireConfiguration().gauche?.titre).toBe('beaucoup t')
  })
})

describe('dossier déjà utilisé', () => {
  it('signale le dossier déjà pris par un autre emplacement', () => {
    const configuration = configurationAvec({ source: dossier('a') })

    expect(emplacementDejaUtilise(configuration, 'gauche', dossier('a'))).toBe('source')
  })

  it('autorise le remplacement d’un emplacement par lui-même', () => {
    const configuration = configurationAvec({ gauche: dossier('a') })

    expect(emplacementDejaUtilise(configuration, 'gauche', dossier('a'))).toBeNull()
  })

  it('distingue deux dossiers de même identifiant dans des drives différents', () => {
    const configuration = configurationAvec({
      source: dossier('a', 'mon-drive'),
    })

    expect(emplacementDejaUtilise(configuration, 'gauche', dossier('a', 'autre-drive'))).toBeNull()
  })
})

describe('conditions de démarrage du tri', () => {
  it('refuse de commencer sans dossier source', () => {
    expect(peutCommencerLeTri(configurationAvec({ gauche: dossier('b') }))).toBe(false)
  })

  it('refuse de commencer sans aucune destination', () => {
    const configuration = configurationAvec({
      source: dossier('a'),
      poubelle: dossier('p'),
    })

    expect(peutCommencerLeTri(configuration)).toBe(false)
  })

  it('accepte une source, une poubelle et une seule destination', () => {
    const configuration = configurationAvec({
      source: dossier('a'),
      poubelle: dossier('p'),
      bas: dossier('b'),
    })

    expect(peutCommencerLeTri(configuration)).toBe(true)
  })

  it('refuse de commencer sans dossier Poubelle', () => {
    const configuration = configurationAvec({
      source: dossier('a'),
      bas: dossier('b'),
    })

    expect(peutCommencerLeTri(configuration)).toBe(false)
  })

  it('ne compte ni la source ni la poubelle comme destinations', () => {
    const configuration = configurationAvec({
      source: dossier('a'),
      poubelle: dossier('p'),
      gauche: dossier('b'),
      droite: dossier('c'),
    })

    expect(compterDestinations(configuration)).toBe(2)
  })
})
