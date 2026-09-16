import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DIRECTIONS } from '../tri/directions'
import { MANIFESTE, OPTIONS_PWA } from './configurationPwa'

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8')

/**
 * Le manifeste n'est lu que par le navigateur, au moment de l'installation : une
 * erreur ne se verrait qu'en installant réellement l'application sur un
 * téléphone. Ces tests vérifient donc à sa place les points qui cassent
 * silencieusement.
 */
describe('manifeste de l’application installable', () => {
  it('démarre dans le sous-dossier de GitHub Pages et non à la racine du domaine', () => {
    // « . » se résout par rapport à l'adresse du manifeste, donc /TriPhoto/.
    // Un « / » ouvrirait https://isark.github.io, hors de l'application.
    expect(MANIFESTE.start_url).toBe('.')
    expect(MANIFESTE.scope).toBe('.')
  })

  it('s’ouvre en plein écran, sans la barre d’adresse du navigateur', () => {
    expect(MANIFESTE.display).toBe('standalone')
  })

  it('fournit les deux tailles d’icône attendues et une icône rognable', () => {
    const icones = MANIFESTE.icons ?? []
    const tailles = icones.map((icone) => icone.sizes)

    expect(tailles).toContain('192x192')
    expect(tailles).toContain('512x512')
    expect(icones.filter((icone) => icone.purpose === 'maskable')).toHaveLength(1)
    // Relatives elles aussi : une icône en « /icone-192.png » serait cherchée à la
    // racine du domaine, où GitHub Pages ne publie rien.
    for (const icone of icones) {
      expect(icone.src.startsWith('/')).toBe(false)
    }
  })

  it('reprend les couleurs du thème', () => {
    expect(MANIFESTE.theme_color).toBe('#405885')
    expect(MANIFESTE.background_color).toBe('#f7f5f2')
  })
})

/**
 * Ces vérifications portent sur des décisions de configuration plutôt que sur un
 * comportement : elles se désactivent d'un seul mot, sans qu'aucun écran ne
 * bronche, et leurs conséquences ne se verraient qu'en production.
 */
describe('garde-fous de la configuration du service worker', () => {
  it('ne met jamais en cache les réponses de Microsoft Graph', () => {
    // Une règle de cache d'exécution sur Graph afficherait des photos déjà
    // déplacées et laisserait des données privées dans le navigateur.
    expect(OPTIONS_PWA.workbox?.runtimeCaching).toBeUndefined()
  })

  it('n’active pas la nouvelle version par-dessus un tri en cours', () => {
    // « autoUpdate » force skipWaiting : une publication pendant que
    // l'application est ouverte remplacerait les fichiers sous les pieds de la page.
    expect(OPTIONS_PWA.registerType).not.toBe('autoUpdate')
  })

  it('sert la page de l’application pour une adresse inconnue, même hors ligne', () => {
    expect(OPTIONS_PWA.workbox?.navigateFallback).toBe('index.html')
  })
})

describe('icônes', () => {
  const theme = lire('../ui/theme.css')

  /**
   * `DIRECTIONS` donne les couleurs sous forme de variables CSS (« var(--bleu) »),
   * alors que les icônes les écrivent en dur. On va donc chercher la valeur dans
   * le thème pour comparer ce qui est comparable.
   */
  const couleurDuTheme = (reference: string) => {
    const nom = reference.slice('var('.length, -1).trim()
    const trouve = new RegExp(`${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(theme)
    if (trouve === null) {
      throw new Error(`La variable ${nom} n’a pas de valeur dans le thème.`)
    }
    return trouve[1].toLowerCase()
  }

  // Les icônes sont chargées hors de la page (onglet, écran d'accueil), où les
  // variables CSS du thème n'existent pas : leurs couleurs y sont donc écrites en
  // dur. Ce test est le seul lien qui les rattache à la source de vérité.
  it('dessinent les quatre directions avec les couleurs de la table des directions', () => {
    for (const nom of ['icone.svg', 'icone-maskable.svg']) {
      const svg = lire(`../../public/${nom}`).toLowerCase()
      for (const info of DIRECTIONS) {
        expect(svg).toContain(couleurDuTheme(info.couleur))
      }
    }
  })

  it('remplissent leur fond, pour que le rognage d’Android ne laisse aucun angle vide', () => {
    expect(lire('../../public/icone-maskable.svg')).toContain(
      '<rect width="48" height="48" fill="#f7f5f2" />',
    )
  })
})
