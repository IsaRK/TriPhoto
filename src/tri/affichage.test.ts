import { describe, expect, it } from 'vitest'
import type { Configuration, DossierConfigure } from '../config/configuration'
import { CONFIGURATION_VIDE } from '../config/configuration'
import type { MediaOneDrive } from '../graph/medias'
import {
  destinationsConfigurees,
  formaterDatePriseDeVue,
  formaterProgression,
  urlAffichage,
} from './affichage'

function dossier(nom: string, titre: string): DossierConfigure {
  return { id: nom, driveId: 'mon-drive', nom, chemin: `OneDrive / ${nom}`, titre }
}

function configurationAvec(champs: Partial<Configuration>): Configuration {
  return { ...CONFIGURATION_VIDE, ...champs }
}

function media(champs: Partial<MediaOneDrive>): MediaOneDrive {
  return {
    id: 'm1',
    driveId: 'mon-drive',
    nom: 'photo.jpg',
    type: 'image',
    priseLe: '2024-07-14T10:00:00Z',
    instantPriseLe: Date.parse('2024-07-14T10:00:00Z'),
    urlTelechargement: 'https://exemple/fichier.jpg',
    urlMiniature: 'https://exemple/miniature.jpg',
    taille: 1000,
    ...champs,
  }
}

describe('destinations configurées', () => {
  it('ne retient que les directions qui ont un dossier', () => {
    const configuration = configurationAvec({
      gauche: dossier('Vacances', 'Vacances'),
      bas: dossier('Divers', 'Divers'),
    })

    const destinations = destinationsConfigurees(configuration)

    expect(destinations.map((d) => d.direction)).toEqual(['gauche', 'bas'])
  })

  it('reprend le titre court et la couleur de la direction', () => {
    const configuration = configurationAvec({ droite: dossier('Souvenirs', 'Été 24') })

    const destinations = destinationsConfigurees(configuration)

    expect(destinations).toEqual([
      { direction: 'droite', titre: 'Été 24', couleur: 'var(--orange)' },
    ])
  })

  it('suit l’ordre des directions et non celui de la configuration', () => {
    const configuration = configurationAvec({
      bas: dossier('D', 'D'),
      haut: dossier('C', 'C'),
      droite: dossier('B', 'B'),
      gauche: dossier('A', 'A'),
    })

    const destinations = destinationsConfigurees(configuration)

    expect(destinations.map((d) => d.direction)).toEqual(['gauche', 'droite', 'haut', 'bas'])
  })

  it('ne renvoie rien quand aucune direction n’est configurée', () => {
    expect(destinationsConfigurees(CONFIGURATION_VIDE)).toEqual([])
  })

  it('ignore la source et la poubelle', () => {
    const configuration = configurationAvec({
      source: dossier('Pellicule', 'Pellicule'),
      poubelle: dossier('Corbeille', 'Corbeille'),
    })

    expect(destinationsConfigurees(configuration)).toEqual([])
  })
})

describe('url d’affichage', () => {
  it('préfère la miniature pour une image', () => {
    expect(urlAffichage(media({}))).toBe('https://exemple/miniature.jpg')
  })

  it('retombe sur le fichier quand l’image n’a pas de miniature', () => {
    expect(urlAffichage(media({ urlMiniature: null }))).toBe('https://exemple/fichier.jpg')
  })

  it('utilise le fichier pour une vidéo même si une miniature existe', () => {
    expect(urlAffichage(media({ type: 'video' }))).toBe('https://exemple/fichier.jpg')
  })

  it('ne renvoie rien quand aucune url n’est exploitable', () => {
    expect(urlAffichage(media({ urlMiniature: null, urlTelechargement: null }))).toBeNull()
  })

  it('ne renvoie rien pour une vidéo sans lien de téléchargement', () => {
    expect(urlAffichage(media({ type: 'video', urlTelechargement: null }))).toBeNull()
  })
})

describe('date de prise de vue', () => {
  it('écrit la date en toutes lettres', () => {
    expect(formaterDatePriseDeVue('2024-07-14T10:00:00Z')).toBe('14 July 2024')
  })

  it('signale une date absente', () => {
    expect(formaterDatePriseDeVue(null)).toBe('Unknown date')
  })

  it('signale une date illisible plutôt que d’afficher « Invalid Date »', () => {
    expect(formaterDatePriseDeVue('pas une date')).toBe('Unknown date')
  })
})

describe('progression', () => {
  it('compte à partir de 1 et non de 0', () => {
    expect(formaterProgression(0, 340)).toBe('1 / 340')
  })

  it('affiche la position courante', () => {
    expect(formaterProgression(11, 340)).toBe('12 / 340')
  })
})
