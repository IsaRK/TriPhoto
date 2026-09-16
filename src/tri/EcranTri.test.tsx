import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration, DossierConfigure } from '../config/configuration'
import { CONFIGURATION_VIDE } from '../config/configuration'
import EcranTri from './EcranTri'

const CLE = 'triphoto.configuration'

const instanceSimulee = {
  acquireTokenSilent: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}

let comptesSimules: { homeAccountId: string; username: string }[] = []

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: instanceSimulee,
    accounts: comptesSimules,
    inProgress: 'none',
  }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function dossier(nom: string, titre = nom): DossierConfigure {
  return { id: nom, driveId: 'mon-drive', nom, chemin: `OneDrive / ${nom}`, titre }
}

function enregistrer(champs: Partial<Configuration>) {
  window.localStorage.setItem(CLE, JSON.stringify({ ...CONFIGURATION_VIDE, ...champs }))
}

function configurationComplete() {
  enregistrer({
    source: dossier('Pellicule'),
    poubelle: dossier('Corbeille'),
    gauche: dossier('Vacances', 'Vacances'),
  })
}

function elementGraph(champs: Record<string, unknown>) {
  return {
    id: 'inconnu',
    name: 'photo.jpg',
    size: 1000,
    file: { mimeType: 'image/jpeg' },
    thumbnails: [{ large: { url: 'https://exemple/miniature.jpg' } }],
    '@microsoft.graph.downloadUrl': 'https://exemple/fichier.jpg',
    ...champs,
  }
}

function json(donnees: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => donnees } as Response)
}

function simulerGraph(elements: Record<string, unknown>[]) {
  return vi.fn(() => json({ value: elements }))
}

function afficher() {
  return render(
    <MemoryRouter initialEntries={['/tri']}>
      <Routes>
        <Route path="/tri" element={<EcranTri />} />
        <Route path="/" element={<h1>Configuration</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

function progression() {
  return screen.getByText(/\d+ \/ \d+/).textContent
}

beforeEach(() => {
  window.localStorage.clear()
  comptesSimules = [{ homeAccountId: 'compte-1', username: 'alice@outlook.com' }]
  instanceSimulee.acquireTokenSilent.mockResolvedValue({ accessToken: 'jeton-de-test' })
  vi.stubGlobal('fetch', simulerGraph([]))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('accès à l’écran de tri', () => {
  it('refuse de trier sans configuration', async () => {
    afficher()

    expect(await screen.findByText(/Choisissez un dossier à trier/)).toBeInTheDocument()
  })

  it('refuse de trier sans aucune destination', async () => {
    enregistrer({ source: dossier('Pellicule') })
    afficher()

    expect(await screen.findByText(/Choisissez un dossier à trier/)).toBeInTheDocument()
  })

  it('refuse de trier sans compte connecté', async () => {
    configurationComplete()
    comptesSimules = []
    afficher()

    expect(await screen.findByText('Connectez-vous pour trier vos médias.')).toBeInTheDocument()
  })

  it('ne lit aucun média tant qu’aucun dossier n’est choisi', async () => {
    const appels = simulerGraph([])
    vi.stubGlobal('fetch', appels)
    afficher()

    await screen.findByText(/Choisissez un dossier à trier/)

    expect(appels).not.toHaveBeenCalled()
  })

  it('ne lit aucun média quand la source est choisie mais aucune destination', async () => {
    enregistrer({ source: dossier('Pellicule') })
    const appels = simulerGraph([])
    vi.stubGlobal('fetch', appels)
    afficher()

    await screen.findByText(/Choisissez un dossier à trier/)

    expect(appels).not.toHaveBeenCalled()
  })
})

describe('affichage des médias', () => {
  it('affiche le média le plus ancien en premier', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'recent', name: 'recent.jpg', photo: { takenDateTime: '2024-08-01T10:00:00Z' } }),
        elementGraph({ id: 'ancien', name: 'ancien.jpg', photo: { takenDateTime: '2024-07-14T10:00:00Z' } }),
      ]),
    )
    afficher()

    expect(await screen.findByAltText('ancien.jpg')).toBeInTheDocument()
  })

  it('affiche la progression et la date de prise de vue', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'a', photo: { takenDateTime: '2024-07-14T10:00:00Z' } }),
        elementGraph({ id: 'b', photo: { takenDateTime: '2024-08-01T10:00:00Z' } }),
      ]),
    )
    afficher()

    await screen.findByAltText('photo.jpg')

    expect(progression()).toBe('1 / 2')
    expect(screen.getByText('14 juillet 2024')).toBeInTheDocument()
  })

  it('avance au média suivant quand on passe', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'a', name: 'premiere.jpg', photo: { takenDateTime: '2024-07-14T10:00:00Z' } }),
        elementGraph({ id: 'b', name: 'seconde.jpg', photo: { takenDateTime: '2024-08-01T10:00:00Z' } }),
      ]),
    )
    afficher()
    await screen.findByAltText('premiere.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Passer ce média' }))

    expect(await screen.findByAltText('seconde.jpg')).toBeInTheDocument()
    expect(progression()).toBe('2 / 2')
  })

  it('affiche une image avec sa miniature', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()

    const image = await screen.findByAltText('photo.jpg')

    expect(image).toHaveAttribute('src', 'https://exemple/miniature.jpg')
  })

  it('affiche une vidéo avec son lien de téléchargement', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'a', name: 'film.mp4', file: { mimeType: 'video/mp4' } }),
      ]),
    )
    const { container } = afficher()

    await waitFor(() => expect(container.querySelector('video')).not.toBeNull())

    expect(container.querySelector('video')).toHaveAttribute('src', 'https://exemple/fichier.jpg')
  })

  it('prévient quand OneDrive n’a donné aucun lien pour le média', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'a', thumbnails: [], '@microsoft.graph.downloadUrl': undefined }),
      ]),
    )
    afficher()

    expect(await screen.findByText(/n'a pas fourni de lien/)).toBeInTheDocument()
  })

  it('précharge le média suivant sans l’afficher', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'a', name: 'premiere.jpg', photo: { takenDateTime: '2024-07-14T10:00:00Z' } }),
        elementGraph({
          id: 'b',
          name: 'seconde.jpg',
          photo: { takenDateTime: '2024-08-01T10:00:00Z' },
          thumbnails: [{ large: { url: 'https://exemple/suivante.jpg' } }],
        }),
      ]),
    )
    const { container } = afficher()
    await screen.findByAltText('premiere.jpg')

    const precharge = container.querySelector('.prechargement')

    expect(precharge).toHaveAttribute('src', 'https://exemple/suivante.jpg')
    expect(screen.queryByAltText('seconde.jpg')).not.toBeInTheDocument()
  })

  it('ne précharge rien sur le dernier média', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    const { container } = afficher()
    await screen.findByAltText('photo.jpg')

    expect(container.querySelector('.prechargement')).toBeNull()
  })

  it('rappelle le titre court de chaque destination configurée', async () => {
    enregistrer({
      source: dossier('Pellicule'),
      poubelle: dossier('Corbeille'),
      gauche: dossier('Vacances', 'Vacances'),
      haut: dossier('Famille', 'Famille'),
    })
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    const titres = [...document.querySelectorAll('.tri__bord')].map((n) => n.textContent)

    expect(titres).toEqual(['Vacances', 'Famille'])
  })

  it('propose les quatre boutons des coins', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Passer ce média' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Envoyer à la poubelle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler le dernier déplacement' })).toBeDisabled()
  })

  it('étiquette les trois boutons des coins qui ne sont pas la poubelle', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    // Le mot visible doit faire partie du libellé lu par un lecteur d'écran,
    // sinon la commande vocale « Accueil » ne trouverait pas le bouton.
    expect(screen.getByText('Accueil')).toBeInTheDocument()
    expect(screen.getByText('Annuler')).toBeInTheDocument()
    expect(screen.getByText('Passer')).toBeInTheDocument()
  })
})

describe('fin et cas limites', () => {
  it('signale un dossier sans photo ni vidéo', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([]))
    afficher()

    expect(await screen.findByText(/ne contient aucune photo ni vidéo/)).toBeInTheDocument()
  })

  it('écarte les fichiers qui ne sont ni image ni vidéo', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([elementGraph({ id: 'doc', name: 'notes.pdf', file: { mimeType: 'application/pdf' } })]),
    )
    afficher()

    expect(await screen.findByText(/ne contient aucune photo ni vidéo/)).toBeInTheDocument()
  })

  it('annonce la fin du tri après le dernier média', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Passer ce média' }))

    expect(await screen.findByText('Tri terminé')).toBeInTheDocument()
    expect(screen.getByText('1 média passé en revue.')).toBeInTheDocument()
  })

  it('permet de repartir du premier média après la fin', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Passer ce média' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Tout revoir' }))

    expect(await screen.findByAltText('photo.jpg')).toBeInTheDocument()
  })
})

describe('erreurs', () => {
  it('affiche un message quand Graph refuse la lecture', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 403, json: async () => ({}) } as Response)),
    )
    afficher()

    expect(await screen.findByText(/code 403/)).toBeInTheDocument()
  })

  it('relance la lecture quand on réessaie', async () => {
    configurationComplete()
    const appels = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
      .mockImplementation(() => json({ value: [elementGraph({ id: 'a' })] }))
    vi.stubGlobal('fetch', appels)
    afficher()
    await screen.findByText(/code 500/)

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByAltText('photo.jpg')).toBeInTheDocument()
  })

  it('propose de se reconnecter quand la session a expiré', async () => {
    configurationComplete()
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'session expirée'),
    )
    afficher()

    expect(await screen.findByRole('button', { name: 'Se reconnecter' })).toBeInTheDocument()
  })

  it('affiche une erreur réseau sans proposer de se reconnecter', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('réseau injoignable'))),
    )
    afficher()

    expect(await screen.findByText(/réseau injoignable/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Se reconnecter' })).not.toBeInTheDocument()
  })
})
