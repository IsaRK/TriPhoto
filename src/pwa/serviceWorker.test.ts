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
  /** Les auditeurs de `controllerchange` posés par le code, pour les déclencher. */
  let auditeurs: Array<() => void> = []

  /**
   * Remplace `navigator.serviceWorker` par un double.
   *
   * `controle` dit si une version précédente contrôlait déjà la page : c'est ce
   * qui distingue une vraie mise à jour d'une première installation.
   */
  const simulerNavigateur = (controle: boolean) => {
    auditeurs = []
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: enregistrer,
        controller: controle ? {} : null,
        addEventListener: (nom: string, auditeur: () => void) => {
          if (nom === 'controllerchange') auditeurs.push(auditeur)
        },
      },
    })
  }

  /** Simule l'activation d'une nouvelle version du service worker. */
  const nouvelleVersionPrendLaMain = () => auditeurs.forEach((auditeur) => auditeur())

  beforeEach(() => {
    enregistrer.mockReset()
    enregistrer.mockResolvedValue({})
    simulerNavigateur(false)
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

  /**
   * Sans rechargement, une version publiée ne se voit qu'au lancement suivant.
   * Sur un téléphone, où l'application installée reste indéfiniment dans les
   * tâches récentes, ce « lancement suivant » n'arrive jamais.
   */
  describe('arrivée d’une nouvelle version', () => {
    const recharger = vi.fn()

    const simulerPage = (chemin: string) => {
      recharger.mockReset()
      vi.stubGlobal('location', { pathname: chemin, reload: recharger })
    }

    it('recharge la page pour afficher la nouvelle version', () => {
      vi.stubEnv('PROD', true)
      simulerNavigateur(true)
      simulerPage('/TriPhoto/')

      enregistrerServiceWorker()
      nouvelleVersionPrendLaMain()

      expect(recharger).toHaveBeenCalled()
    })

    it('ne recharge pas à la première installation', () => {
      vi.stubEnv('PROD', true)
      // Aucune version ne contrôlait la page : ce n'est pas une mise à jour, et
      // recharger ferait clignoter l'application dès la première visite.
      simulerNavigateur(false)
      simulerPage('/TriPhoto/')

      enregistrerServiceWorker()
      nouvelleVersionPrendLaMain()

      expect(recharger).not.toHaveBeenCalled()
    })

    it('ne recharge jamais pendant un tri', () => {
      vi.stubEnv('PROD', true)
      simulerNavigateur(true)
      simulerPage('/TriPhoto/tri')

      enregistrerServiceWorker()
      nouvelleVersionPrendLaMain()

      // Le média affiché et la pile d'annulation vivent en mémoire : un
      // rechargement les perdrait au milieu du tri.
      expect(recharger).not.toHaveBeenCalled()
    })

    it('ne recharge qu’une seule fois', () => {
      vi.stubEnv('PROD', true)
      simulerNavigateur(true)
      simulerPage('/TriPhoto/')

      enregistrerServiceWorker()
      nouvelleVersionPrendLaMain()
      nouvelleVersionPrendLaMain()

      expect(recharger).toHaveBeenCalledTimes(1)
    })
  })
})
