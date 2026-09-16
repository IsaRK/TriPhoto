import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enregistrerServiceWorker } from './serviceWorker'

/**
 * Le service worker est la pièce qui rend TriPhoto installable et utilisable hors
 * ligne. Ces tests vérifient qu'il est demandé à la bonne adresse, et surtout
 * qu'aucun des cas dégradés (navigateur sans l'API, enregistrement refusé) ne fait
 * planter le démarrage de l'application.
 */
describe('enregistrement du service worker', () => {
  const enregistrer = vi.fn()

  beforeEach(() => {
    enregistrer.mockReset()
    enregistrer.mockResolvedValue({})
    vi.stubGlobal('navigator', { serviceWorker: { register: enregistrer } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le code attend l'événement `load` : les tests doivent donc le déclencher. */
  const chargerLaPage = () => window.dispatchEvent(new Event('load'))

  it('n’enregistre rien en développement, où le fichier sw.js n’existe pas', () => {
    vi.stubEnv('PROD', false)

    enregistrerServiceWorker()
    chargerLaPage()

    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('demande sw.js sous le chemin de base, et non à la racine du domaine', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('BASE_URL', '/TriPhoto/')

    enregistrerServiceWorker()
    chargerLaPage()

    expect(enregistrer).toHaveBeenCalledWith('/TriPhoto/sw.js')
  })

  it('attend le chargement de la page avant d’enregistrer', () => {
    vi.stubEnv('PROD', true)

    enregistrerServiceWorker()

    // Sans cet ajournement, l'enregistrement entrerait en concurrence avec le
    // premier rendu de l'application sur un téléphone lent.
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('ne fait rien sur un navigateur qui n’expose pas l’API', () => {
    vi.stubEnv('PROD', true)
    vi.stubGlobal('navigator', {})

    // Le seul comportement attendu est de ne pas lever d'exception.
    expect(() => enregistrerServiceWorker()).not.toThrow()
  })

  it('laisse l’application démarrer même si l’enregistrement échoue', async () => {
    vi.stubEnv('PROD', true)
    enregistrer.mockRejectedValue(new Error('refusé'))
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})

    enregistrerServiceWorker()
    chargerLaPage()
    await vi.waitFor(() => expect(avertir).toHaveBeenCalled())
  })
})
