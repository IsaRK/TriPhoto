import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration, DossierConfigure } from './configuration'
import {
  CONFIGURATION_VIDE,
  EMPLACEMENTS,
  compterDestinations,
  definirDossier,
  ecrireConfiguration,
  effacerConfiguration,
  emplacementDejaUtilise,
  estConfigurationVide,
  lireConfiguration,
  peutCommencerLeTri,
  retirerDossier,
} from './configuration'

const CLE = 'triphoto.configuration'

function dossier(id: string, driveId = 'mon-drive'): DossierConfigure {
  return { id, driveId, nom: `Dossier ${id}`, chemin: `OneDrive / Dossier ${id}` }
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
    const configuration = configurationAvec({ source: dossier('a'), gauche: dossier('b') })

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
      JSON.stringify({ source: { id: 'a', nom: 'Photos', chemin: 'OneDrive / Photos' } }),
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
      JSON.stringify({ source: { id: 'a', driveId: 'mon-drive', nom: 'Photos', chemin: '' } }),
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

    expect(() => ecrireConfiguration(configurationAvec({ source: dossier('a') }))).not.toThrow()
  })

  it('énumère exactement les emplacements du type Configuration', () => {
    expect([...EMPLACEMENTS]).toEqual(Object.keys(CONFIGURATION_VIDE))
  })

  it('efface la configuration enregistrée', () => {
    ecrireConfiguration(configurationAvec({ source: dossier('a') }))

    effacerConfiguration()

    expect(lireConfiguration()).toEqual(CONFIGURATION_VIDE)
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
    const configuration = configurationAvec({ source: dossier('a', 'mon-drive') })

    expect(emplacementDejaUtilise(configuration, 'gauche', dossier('a', 'autre-drive'))).toBeNull()
  })
})

describe('conditions de démarrage du tri', () => {
  it('refuse de commencer sans dossier source', () => {
    expect(peutCommencerLeTri(configurationAvec({ gauche: dossier('b') }))).toBe(false)
  })

  it('refuse de commencer sans aucune destination', () => {
    const configuration = configurationAvec({ source: dossier('a'), poubelle: dossier('p') })

    expect(peutCommencerLeTri(configuration)).toBe(false)
  })

  it('accepte une source et une seule destination', () => {
    const configuration = configurationAvec({ source: dossier('a'), bas: dossier('b') })

    expect(peutCommencerLeTri(configuration)).toBe(true)
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

  it('reconnaît une configuration entièrement vide', () => {
    expect(estConfigurationVide(CONFIGURATION_VIDE)).toBe(true)
    expect(estConfigurationVide(configurationAvec({ poubelle: dossier('p') }))).toBe(false)
  })
})
