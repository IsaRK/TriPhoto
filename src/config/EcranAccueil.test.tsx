import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EcranAccueil from './EcranAccueil'
import { oublierIdDeMonDrive } from '../graph/dossiers'
import type { Configuration } from './configuration'
import { CONFIGURATION_VIDE } from './configuration'

const CLE = 'triphoto.configuration'

const instanceSimulee = {
  acquireTokenSilent: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}

const compte = { homeAccountId: 'compte-1', username: 'alice@outlook.com' }

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: instanceSimulee, accounts: [{ ...compte }], inProgress: 'none' }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function json(donnees: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => donnees } as Response)
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
  return { id, driveId: 'mon-drive', nom, chemin: `OneDrive / ${nom}` }
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
  instanceSimulee.acquireTokenSilent.mockResolvedValue({ accessToken: 'jeton-de-test' })
  vi.stubGlobal('fetch', simulerGraph())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('écran de configuration', () => {
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
    enregistrer({ source: dossier('photos', 'Photos'), gauche: dossier('vacances', 'Vacances') })
    afficher()

    await choisirDossierPour('Gauche', 'Famille')

    expect(configurationEnregistree().gauche).toEqual(dossier('famille', 'Famille'))
  })

  it('retire un dossier de son emplacement', async () => {
    enregistrer({ source: dossier('photos', 'Photos'), gauche: dossier('vacances', 'Vacances') })
    afficher()

    await userEvent.click(screen.getByRole('button', { name: /Retirer le dossier de . Gauche/ }))

    expect(configurationEnregistree().gauche).toBeNull()
    expect(configurationEnregistree().source).toEqual(dossier('photos', 'Photos'))
  })

  it('efface toute la configuration', async () => {
    enregistrer({ source: dossier('photos', 'Photos'), bas: dossier('vacances', 'Vacances') })
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Effacer la configuration' }))

    expect(window.localStorage.getItem(CLE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Commencer le tri' })).toBeDisabled()
  })

  it('relit la configuration enregistrée et mène à l’écran de tri', async () => {
    enregistrer({ source: dossier('photos', 'Photos'), droite: dossier('vacances', 'Vacances') })
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
