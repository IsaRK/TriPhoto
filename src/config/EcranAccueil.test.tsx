import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EcranAccueil from './EcranAccueil'
import { oublierIdDeMonDrive } from '../graph/dossiers'
import type { Configuration } from './configuration'
import { CONFIGURATION_VIDE, TITRE_LONGUEUR_MAX } from './configuration'

const CLE = 'triphoto.configuration'

const instanceSimulee = {
  acquireTokenSilent: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}

const compte = { homeAccountId: 'compte-1', username: 'alice@outlook.com' }

// `vi.mock` est remonté en haut du fichier : sa fabrique ne peut pas lire une
// variable déclarée ici. `vi.hoisted` crée l'objet avant elle, ce qui permet de
// simuler la déconnexion en vidant `comptes` dans un test.
const etatMsal = vi.hoisted(() => ({ comptes: [] as { homeAccountId: string }[] }))

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: instanceSimulee,
    accounts: etatMsal.comptes,
    inProgress: 'none',
  }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function json(donnees: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => donnees,
  } as Response)
}

/** Deux dossiers à la racine du OneDrive, et un profil pour le bloc « compte ». */
function simulerGraph() {
  return vi.fn((url: string) => {
    if (url.endsWith('/v1.0/me')) {
      return json({ displayName: 'Alice' })
    }
    if (url.includes('/me/drive?')) {
      return json({ id: 'mon-drive' })
    }
    if (url.includes('/root/children')) {
      return json({
        value: [
          { id: 'photos', name: 'Photos', folder: { childCount: 3 } },
          { id: 'vacances', name: 'Vacances', folder: { childCount: 1 } },
          { id: 'famille', name: 'Famille', folder: { childCount: 2 } },
        ],
      })
    }
    return json({ value: [] })
  })
}

function dossier(id: string, nom: string) {
  return {
    id,
    driveId: 'mon-drive',
    nom,
    chemin: `OneDrive / ${nom}`,
    titre: nom.slice(0, 10),
  }
}

function enregistrer(champs: Partial<Configuration>) {
  window.localStorage.setItem(CLE, JSON.stringify({ ...CONFIGURATION_VIDE, ...champs }))
}

function configurationEnregistree(): Configuration {
  return JSON.parse(window.localStorage.getItem(CLE) ?? '{}') as Configuration
}

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<EcranAccueil />} />
        <Route path="/tri" element={<h1>Tri</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Parcourt l'explorateur jusqu'à valider le dossier racine nommé `nom`.
 * Le libellé est ancré au début : sinon « Gauche » trouverait aussi le bouton
 * « Retirer le dossier de « Gauche » » dès que l'emplacement est rempli.
 */
async function choisirDossierPour(libelleEmplacement: string, nom: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${libelleEmplacement}`) }))
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(nom) }))
  await userEvent.click(screen.getByRole('button', { name: 'Choisir ce dossier' }))
}

beforeEach(() => {
  window.localStorage.clear()
  oublierIdDeMonDrive()
  etatMsal.comptes = [{ ...compte }]
  instanceSimulee.acquireTokenSilent.mockResolvedValue({
    accessToken: 'jeton-de-test',
  })
  vi.stubGlobal('fetch', simulerGraph())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('écran de configuration', () => {
  it('ne montre que le logo et la connexion tant que personne n’est connecté', () => {
    etatMsal.comptes = []
    afficher()

    expect(screen.getByRole('img', { name: 'TriPhoto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect with Microsoft' })).toBeInTheDocument()
    // Les emplacements et le bouton de tri n'ont aucun sens hors connexion.
    expect(screen.queryByRole('button', { name: /^Dossier à trier/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commencer le tri' })).not.toBeInTheDocument()
  })

  // Le CSS ne s'applique pas en test : on verrouille les deux classes qui portent
  // la mise en page d'accueil, faute de pouvoir vérifier le rendu lui-même.
  it('groupe le logo et le gros bouton de connexion au centre avant connexion', () => {
    etatMsal.comptes = []
    const { container } = afficher()

    expect(container.querySelector('.ecran--accueil')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Connect with Microsoft' })).toHaveClass(
      'action--grande',
    )
  })

  it('ne centre pas l’écran une fois connecté, la liste des dossiers le remplit', () => {
    const { container } = afficher()

    expect(container.querySelector('.ecran--accueil')).toBeNull()
  })

  it('propose les six emplacements à configurer', () => {
    afficher()

    for (const libelle of ['Dossier à trier', 'Gauche', 'Droite', 'Haut', 'Bas', 'Poubelle']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${libelle}`) })).toBeInTheDocument()
    }
  })

  it('affiche une pastille de couleur distincte pour chacune des quatre directions', () => {
    const { container } = afficher()

    const couleurs = [...container.querySelectorAll('.emplacement__pastille')].map((pastille) =>
      pastille.getAttribute('style'),
    )

    expect(couleurs).toHaveLength(4)
    expect(new Set(couleurs).size).toBe(4)
  })

  it('désactive « Commencer le tri » tant que la configuration est incomplète', () => {
    enregistrer({ source: dossier('photos', 'Photos') })
    afficher()

    expect(screen.getByRole('button', { name: 'Commencer le tri' })).toBeDisabled()
  })

  it('enregistre le dossier choisi pour la source', async () => {
    afficher()

    await choisirDossierPour('Dossier à trier', 'Photos')

    expect(configurationEnregistree().source).toEqual(dossier('photos', 'Photos'))
    expect(screen.getByText('OneDrive / Photos')).toBeInTheDocument()
  })

  it('refuse d’affecter le même dossier à deux emplacements', async () => {
    enregistrer({ source: dossier('photos', 'Photos') })
    afficher()

    await choisirDossierPour('Gauche', 'Photos')

    expect(await screen.findByRole('alert')).toHaveTextContent('Dossier à trier')
    expect(configurationEnregistree().gauche).toBeNull()
  })

  it('accepte deux dossiers différents sur deux emplacements', async () => {
    enregistrer({ source: dossier('photos', 'Photos') })
    afficher()

    await choisirDossierPour('Gauche', 'Vacances')

    expect(configurationEnregistree().gauche).toEqual(dossier('vacances', 'Vacances'))
  })

  it('remplace le dossier d’un emplacement déjà rempli', async () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
    })
    afficher()

    await choisirDossierPour('Gauche', 'Famille')

    expect(configurationEnregistree().gauche).toEqual(dossier('famille', 'Famille'))
  })

  it('retire un dossier de son emplacement', async () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
    })
    afficher()

    await userEvent.click(screen.getByRole('button', { name: /Retirer le dossier de . Gauche/ }))

    expect(configurationEnregistree().gauche).toBeNull()
    expect(configurationEnregistree().source).toEqual(dossier('photos', 'Photos'))
  })

  it('nomme une direction avec le nom du dossier choisi', async () => {
    enregistrer({ source: dossier('photos', 'Photos') })
    afficher()

    await choisirDossierPour('Gauche', 'Vacances')

    expect(screen.getByRole('textbox', { name: /Titre court de . Gauche/ })).toHaveValue('Vacances')
  })

  it('n’offre un titre court que sur les quatre directions', () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
      droite: dossier('famille', 'Famille'),
      haut: dossier('amis', 'Amis'),
      bas: dossier('divers', 'Divers'),
      poubelle: dossier('corbeille', 'Corbeille'),
    })
    afficher()

    const champs = screen.getAllByRole('textbox')

    expect(champs).toHaveLength(4)
    expect(screen.queryByRole('textbox', { name: /Dossier à trier/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Poubelle/ })).not.toBeInTheDocument()
  })

  it('enregistre le titre court saisi', async () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
    })
    afficher()

    const champ = screen.getByRole('textbox', {
      name: /Titre court de . Gauche/,
    })
    await userEvent.clear(champ)
    await userEvent.type(champ, 'Été 2024')
    await userEvent.tab()

    expect(configurationEnregistree().gauche?.titre).toBe('Été 2024')
  })

  it('revient au titre par défaut quand on laisse le champ vide', async () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
    })
    afficher()

    const champ = screen.getByRole('textbox', {
      name: /Titre court de . Gauche/,
    })
    await userEvent.clear(champ)
    await userEvent.tab()

    expect(configurationEnregistree().gauche?.titre).toBe('Vacances')
  })

  it('empêche de saisir plus de dix caractères', () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      gauche: dossier('vacances', 'Vacances'),
    })
    afficher()

    expect(screen.getByRole('textbox', { name: /Titre court de . Gauche/ })).toHaveAttribute(
      'maxlength',
      String(TITRE_LONGUEUR_MAX),
    )
  })

  it('prévient quand le navigateur refuse d’enregistrer', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage refusé')
    })
    afficher()

    await choisirDossierPour('Dossier à trier', 'Photos')

    expect(await screen.findByRole('alert')).toHaveTextContent('refuse d’enregistrer')
  })

  it('retrouve les dossiers choisis après un rechargement de la page', async () => {
    const premierAffichage = afficher()

    await choisirDossierPour('Dossier à trier', 'Photos')
    await choisirDossierPour('Gauche', 'Vacances')
    await choisirDossierPour('Poubelle', 'Famille')

    premierAffichage.unmount()
    afficher()

    expect(screen.getByText('OneDrive / Photos')).toBeInTheDocument()
    expect(screen.getByText('OneDrive / Vacances')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commencer le tri' })).toBeEnabled()
  })

  it('laisse « Commencer le tri » grisé tant que la poubelle manque', async () => {
    afficher()

    await choisirDossierPour('Dossier à trier', 'Photos')
    await choisirDossierPour('Gauche', 'Vacances')

    expect(screen.getByRole('button', { name: 'Commencer le tri' })).toBeDisabled()
    expect(screen.getByText('Il manque le dossier Poubelle.')).toBeInTheDocument()
  })

  it('relit la configuration enregistrée et mène à l’écran de tri', async () => {
    enregistrer({
      source: dossier('photos', 'Photos'),
      poubelle: dossier('famille', 'Famille'),
      droite: dossier('vacances', 'Vacances'),
    })
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Commencer le tri' }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tri')
  })

  it('revient à la liste des emplacements quand on annule le choix', async () => {
    afficher()

    await userEvent.click(screen.getByRole('button', { name: /Dossier à trier/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByRole('button', { name: 'Commencer le tri' })).toBeInTheDocument()
  })
})

describe('bouton Exit', () => {
  it('ferme l’application', async () => {
    const fermer = vi.spyOn(window, 'close').mockImplementation(() => {})
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Exit' }))

    expect(fermer).toHaveBeenCalled()
  })

  it('est proposé avant même la connexion', () => {
    etatMsal.comptes = []
    afficher()

    expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument()
  })

  it('reste proposé pendant le choix d’un dossier', async () => {
    afficher()

    await userEvent.click(screen.getByRole('button', { name: /^Dossier à trier/ }))

    expect(await screen.findByRole('button', { name: 'Exit' })).toBeInTheDocument()
  })

  it('prévient quand le navigateur refuse de fermer l’onglet', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Exit' }))

    expect(await screen.findByText(/refuse de fermer un onglet/)).toBeInTheDocument()
  })

  it('ne dit rien quand la fenêtre s’est bien fermée', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    // jsdom ne ferme jamais sa fenêtre : on force `closed` pour jouer le succès.
    const descripteur = Object.getOwnPropertyDescriptor(window, 'closed')
    Object.defineProperty(window, 'closed', { value: true, configurable: true })
    try {
      afficher()

      await userEvent.click(screen.getByRole('button', { name: 'Exit' }))
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(screen.queryByText(/refuse de fermer un onglet/)).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'closed', descripteur ?? { value: false, configurable: true })
    }
  })
})
