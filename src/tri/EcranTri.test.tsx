import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/**
 * Comme `simulerGraph`, mais répond aussi aux `PATCH` de déplacement. Le mock
 * distingue les deux sur la méthode HTTP, comme le ferait Graph.
 */
function simulerGraphEtDeplacements(elements: Record<string, unknown>[]) {
  return vi.fn((_url: string, options?: RequestInit) =>
    options?.method === 'PATCH' ? json({}) : json({ value: elements }),
  )
}

/** Les corps des `PATCH` envoyés, dans l'ordre, pour vérifier les destinations. */
function deplacementsDemandes(fetchSimule: ReturnType<typeof vi.fn>) {
  return fetchSimule.mock.calls
    .filter(([, options]) => (options as RequestInit | undefined)?.method === 'PATCH')
    .map(([url, options]) => ({
      url: url as string,
      corps: JSON.parse((options as RequestInit).body as string) as {
        parentReference: { id: string }
      },
    }))
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

    expect(await screen.findByText(/Choose a folder to sort/)).toBeInTheDocument()
  })

  it('refuse de trier sans aucune destination', async () => {
    enregistrer({ source: dossier('Pellicule') })
    afficher()

    expect(await screen.findByText(/Choose a folder to sort/)).toBeInTheDocument()
  })

  it('refuse de trier sans compte connecté', async () => {
    configurationComplete()
    comptesSimules = []
    afficher()

    expect(await screen.findByText('Sign in to sort your media.')).toBeInTheDocument()
  })

  it('ne lit aucun média tant qu’aucun dossier n’est choisi', async () => {
    const appels = simulerGraph([])
    vi.stubGlobal('fetch', appels)
    afficher()

    await screen.findByText(/Choose a folder to sort/)

    expect(appels).not.toHaveBeenCalled()
  })

  it('ne lit aucun média quand la source est choisie mais aucune destination', async () => {
    enregistrer({ source: dossier('Pellicule') })
    const appels = simulerGraph([])
    vi.stubGlobal('fetch', appels)
    afficher()

    await screen.findByText(/Choose a folder to sort/)

    expect(appels).not.toHaveBeenCalled()
  })
})

describe('affichage des médias', () => {
  it('affiche le média le plus ancien en premier', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({
          id: 'recent',
          name: 'recent.jpg',
          photo: { takenDateTime: '2024-08-01T10:00:00Z' },
        }),
        elementGraph({
          id: 'ancien',
          name: 'ancien.jpg',
          photo: { takenDateTime: '2024-07-14T10:00:00Z' },
        }),
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
    expect(screen.getByText('14 July 2024')).toBeInTheDocument()
  })

  it('avance au média suivant quand on passe', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({
          id: 'a',
          name: 'premiere.jpg',
          photo: { takenDateTime: '2024-07-14T10:00:00Z' },
        }),
        elementGraph({
          id: 'b',
          name: 'seconde.jpg',
          photo: { takenDateTime: '2024-08-01T10:00:00Z' },
        }),
      ]),
    )
    afficher()
    await screen.findByAltText('premiere.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

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
      simulerGraph([elementGraph({ id: 'a', name: 'film.mp4', file: { mimeType: 'video/mp4' } })]),
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

    expect(await screen.findByText(/did not provide a link/)).toBeInTheDocument()
  })

  it('précharge le média suivant sans l’afficher', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({
          id: 'a',
          name: 'premiere.jpg',
          photo: { takenDateTime: '2024-07-14T10:00:00Z' },
        }),
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

    // Ces quatre boutons portent leur mot seul : le texte visible est donc aussi
    // le libellé lu par un lecteur d'écran, sans aria-label à tenir à jour.
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    // Rien n'a encore été supprimé : il n'y a rien à annuler.
    expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled()
  })
})

describe('liens expirés', () => {
  /**
   * Comme `simulerGraph`, mais répond aussi aux relectures d'un média seul. Le
   * mock les distingue sur l'URL, comme le ferait Graph : la liste passe par
   * `/children`, la relecture vise directement l'élément.
   */
  function simulerGraphAvecRelecture(
    elements: Record<string, unknown>[],
    relecture: () => Promise<Response>,
  ) {
    return vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') {
        return json({})
      }
      return url.includes('/children') ? json({ value: elements }) : relecture()
    })
  }

  function refus(status: number): Promise<Response> {
    return Promise.resolve({ ok: false, status, json: async () => ({}) } as Response)
  }

  function lienFrais(champs: Record<string, unknown> = {}) {
    return json(
      elementGraph({
        id: 'a',
        thumbnails: [{ large: { url: 'https://exemple/frais.jpg' } }],
        ...champs,
      }),
    )
  }

  it('redemande un lien frais quand l’image ne se charge pas', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => lienFrais())
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    const image = await screen.findByAltText('photo.jpg')
    expect(image).toHaveAttribute('src', 'https://exemple/miniature.jpg')

    // Ce que fait le navigateur quand le lien signé par Graph a expiré.
    fireEvent.error(image)

    await waitFor(() =>
      expect(screen.getByAltText('photo.jpg')).toHaveAttribute('src', 'https://exemple/frais.jpg'),
    )
    expect(fetchSimule.mock.calls[1][0]).toContain('/items/a?')
  })

  it('garde la position dans le tri après un lien renouvelé', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture(
      [
        elementGraph({
          id: 'z',
          name: 'ancienne.jpg',
          photo: { takenDateTime: '2024-01-01T00:00:00Z' },
        }),
        elementGraph({ id: 'a', photo: { takenDateTime: '2024-08-01T00:00:00Z' } }),
      ],
      // Date volontairement plus ancienne que celle du premier média : si le
      // remplacement re-triait la liste, ce média repasserait en tête.
      () => lienFrais({ photo: { takenDateTime: '2023-01-01T00:00:00Z' } }),
    )
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('ancienne.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    const image = await screen.findByAltText('photo.jpg')
    expect(progression()).toBe('2 / 2')

    fireEvent.error(image)

    await waitFor(() =>
      expect(screen.getByAltText('photo.jpg')).toHaveAttribute('src', 'https://exemple/frais.jpg'),
    )
    expect(progression()).toBe('2 / 2')
  })

  it('n’insiste pas quand le lien frais ne marche pas non plus', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => lienFrais())
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    fireEvent.error(await screen.findByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByAltText('photo.jpg')).toHaveAttribute('src', 'https://exemple/frais.jpg'),
    )

    fireEvent.error(screen.getByAltText('photo.jpg'))

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
    // La liste, puis une seule relecture : on ne martèle pas Graph.
    expect(fetchSimule).toHaveBeenCalledTimes(2)
  })

  it('signale un média illisible quand Graph refuse de le relire', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => refus(404)),
    )
    afficher()

    fireEvent.error(await screen.findByAltText('photo.jpg'))

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
  })

  it('laisse trier un média illisible', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => refus(404))
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    fireEvent.error(await screen.findByAltText('photo.jpg'))
    await screen.findByText(/could not be loaded/)

    // Un média qu'on ne peut pas voir reste un média qu'on peut ranger.
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deplacementsDemandes(fetchSimule)).toHaveLength(1))
    expect(deplacementsDemandes(fetchSimule)[0].corps.parentReference.id).toBe('Corbeille')
  })

  it('ne confond pas un échec en double avec l’échec du lien frais', async () => {
    // La carte et le préchargement butent sur leurs liens expirés au même
    // instant, puis l'utilisateur passe au suivant avant que Graph n'ait
    // répondu : le média suivant se remonte avec son ancien lien, qui échoue
    // une seconde fois. Ce second échec ne dit rien de neuf.
    configurationComplete()
    let repondre: (() => void) | null = null
    const fetchSimule = simulerGraphAvecRelecture(
      [
        elementGraph({ id: 'a', photo: { takenDateTime: '2024-01-01T00:00:00Z' } }),
        elementGraph({
          id: 'b',
          name: 'seconde.jpg',
          photo: { takenDateTime: '2024-08-01T00:00:00Z' },
        }),
      ],
      () =>
        new Promise<Response>((resoudre) => {
          repondre = () =>
            resoudre({
              ok: true,
              status: 200,
              json: async () => elementGraph({ id: 'b', name: 'seconde.jpg' }),
            } as Response)
        }),
    )
    vi.stubGlobal('fetch', fetchSimule)
    const { container } = afficher()
    await screen.findByAltText('photo.jpg')

    fireEvent.error(container.querySelector('.prechargement')!)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.error(await screen.findByAltText('seconde.jpg'))
    act(() => repondre!())

    // Le lien frais est bien essayé : le média n'a pas été condamné entre-temps.
    await waitFor(() =>
      expect(screen.getByAltText('seconde.jpg')).toHaveAttribute(
        'src',
        'https://exemple/miniature.jpg',
      ),
    )
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
  })

  it('renouvelle le lien d’une vidéo comme celui d’une image', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture(
      [elementGraph({ id: 'a', name: 'film.mp4', file: { mimeType: 'video/mp4' } })],
      () =>
        json(
          elementGraph({
            id: 'a',
            name: 'film.mp4',
            file: { mimeType: 'video/mp4' },
            '@microsoft.graph.downloadUrl': 'https://exemple/film-frais.mp4',
          }),
        ),
    )
    vi.stubGlobal('fetch', fetchSimule)
    const { container } = afficher()
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull())

    fireEvent.error(container.querySelector('video')!)

    await waitFor(() =>
      expect(container.querySelector('video')).toHaveAttribute(
        'src',
        'https://exemple/film-frais.mp4',
      ),
    )
  })

  it('redonne sa chance à un média illisible quand on repart du début', async () => {
    // Une nouvelle passe arrive potentiellement une heure plus tard : les liens
    // renouvelés ont pu expirer à leur tour.
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => refus(404))
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    fireEvent.error(await screen.findByAltText('photo.jpg'))
    await screen.findByText(/could not be loaded/)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Review again' }))

    const image = await screen.findByAltText('photo.jpg')
    fireEvent.error(image)
    // La liste, la relecture de la première passe, puis celle de la seconde.
    await waitFor(() => expect(fetchSimule).toHaveBeenCalledTimes(3))
  })

  it('parle de session expirée plutôt que de média illisible', async () => {
    // La session Microsoft expire elle aussi au bout d'une heure : c'est le
    // même moment, mais pas le même problème.
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraphAvecRelecture([elementGraph({ id: 'a' })], () => lienFrais()),
    )
    afficher()
    const image = await screen.findByAltText('photo.jpg')
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'session expirée'),
    )

    fireEvent.error(image)

    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
  })

  it('renouvelle aussi le lien du média préchargé', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphAvecRelecture(
      [
        elementGraph({ id: 'a', photo: { takenDateTime: '2024-01-01T00:00:00Z' } }),
        elementGraph({
          id: 'b',
          name: 'seconde.jpg',
          photo: { takenDateTime: '2024-08-01T00:00:00Z' },
        }),
      ],
      () => lienFrais({ id: 'b', name: 'seconde.jpg' }),
    )
    vi.stubGlobal('fetch', fetchSimule)
    const { container } = afficher()
    await screen.findByAltText('photo.jpg')

    fireEvent.error(container.querySelector('.prechargement')!)

    await waitFor(() =>
      expect(container.querySelector('.prechargement')).toHaveAttribute(
        'src',
        'https://exemple/frais.jpg',
      ),
    )
    expect(fetchSimule.mock.calls[1][0]).toContain('/items/b?')
  })
})

describe('poubelle et annulation', () => {
  it('déplace le média vers la poubelle et passe au suivant', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()
    const deplacements = deplacementsDemandes(fetchSimule)
    expect(deplacements).toHaveLength(1)
    expect(deplacements[0].url).toContain('/items/a')
    expect(deplacements[0].corps.parentReference.id).toBe('Corbeille')
  })

  it('active Cancel après une suppression', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraphEtDeplacements([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeEnabled(),
    )
  })

  it('ramène le média dans le dossier à trier et revient dessus', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByAltText('b.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))

    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    const deplacements = deplacementsDemandes(fetchSimule)
    expect(deplacements[1].corps.parentReference.id).toBe('Pellicule')
    // Plus rien à récupérer : la suppression a bien été défaite.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled(),
    )
  })

  it('annule plusieurs déplacements de suite, du plus récent au plus ancien', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
      elementGraph({ id: 'c', name: 'c.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByAltText('b.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByAltText('c.jpg')

    // Premier appui : on récupère « b », la dernière supprimée.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()

    // Second appui : on remonte jusqu'à « a ».
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()

    // La pile est vide : il n'y a plus rien à annuler.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled(),
    )
    // Deux suppressions, puis deux retours vers le dossier à trier.
    expect(deplacementsDemandes(fetchSimule).map((d) => d.corps.parentReference.id)).toEqual([
      'Corbeille',
      'Corbeille',
      'Pellicule',
      'Pellicule',
    ])
  })

  it('annule aussi bien un swipe qu’une suppression, dans l’ordre inverse', async () => {
    enregistrer({
      source: dossier('Pellicule'),
      poubelle: dossier('Corbeille'),
      gauche: dossier('Vacances', 'Vacances'),
    })
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
      elementGraph({ id: 'c', name: 'c.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    // « a » part vers une destination, « b » à la poubelle.
    await userEvent.click(screen.getByRole('button', { name: 'Vacances' }))
    await screen.findByAltText('b.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByAltText('c.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))

    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    expect(deplacementsDemandes(fetchSimule).map((d) => d.corps.parentReference.id)).toEqual([
      'Vacances',
      'Corbeille',
      'Pellicule',
      'Pellicule',
    ])
  })

  it('revient à la bonne position quand un média a été passé entre deux déplacements', async () => {
    enregistrer({
      source: dossier('Pellicule'),
      poubelle: dossier('Corbeille'),
      gauche: dossier('Vacances', 'Vacances'),
    })
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
      elementGraph({ id: 'c', name: 'c.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    // « a » est rangée, « b » est seulement passée, « c » part à la poubelle.
    await userEvent.click(screen.getByRole('button', { name: 'Vacances' }))
    await screen.findByAltText('b.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByAltText('c.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByText('Sorting complete')

    // La première annulation ramène « c », troisième de la liste.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('c.jpg')).toBeInTheDocument()
    expect(progression()).toBe('3 / 3')

    // La seconde saute par-dessus « b », qui n'a jamais été déplacée : on
    // revient à la position exacte de « a », pas simplement d'un cran en arrière.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    expect(progression()).toBe('1 / 3')
  })

  it('vide la pile d’annulation quand on repart du début', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
      elementGraph({ id: 'c', name: 'c.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    for (const nom of ['a.jpg', 'b.jpg', 'c.jpg']) {
      await screen.findByAltText(nom)
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    }
    await screen.findByText('Sorting complete')

    // Repartir du début oublie la passe précédente : les positions mémorisées
    // ne veulent plus rien dire maintenant qu'on est revenu au premier média.
    await userEvent.click(screen.getByRole('button', { name: 'Review again' }))
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled()

    // Une suppression de cette passe-ci s'annule normalement, et une seule fois :
    // sans la remise à zéro, un second appui ferait ressortir « c » de sa poubelle.
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled(),
    )
    expect(deplacementsDemandes(fetchSimule).map((d) => d.corps.parentReference.id)).toEqual([
      'Corbeille',
      'Corbeille',
      'Corbeille',
      'Corbeille',
      'Pellicule',
    ])
  })

  it('garde toute la pile quand une annulation échoue', async () => {
    configurationComplete()
    let refuser = false
    const fetchSimule = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method !== 'PATCH') {
        return json({
          value: [
            elementGraph({ id: 'a', name: 'a.jpg' }),
            elementGraph({ id: 'b', name: 'b.jpg' }),
            elementGraph({ id: 'c', name: 'c.jpg' }),
          ],
        })
      }
      return refuser
        ? Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response)
        : json({})
    })
    vi.stubGlobal('fetch', fetchSimule)
    afficher()

    for (const nom of ['a.jpg', 'b.jpg', 'c.jpg']) {
      await screen.findByAltText(nom)
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    }
    await screen.findByText('Sorting complete')

    refuser = true
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    await screen.findByText(/The move failed/)

    // L'échec n'a rien dépilé : les trois photos restent rattrapables, dans
    // l'ordre inverse de leur suppression.
    refuser = false
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('c.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))
    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeDisabled(),
    )

    // Trois suppressions, une annulation refusée, puis les trois retours.
    expect(deplacementsDemandes(fetchSimule).map((d) => d.corps.parentReference.id)).toEqual([
      'Corbeille',
      'Corbeille',
      'Corbeille',
      'Pellicule',
      'Pellicule',
      'Pellicule',
      'Pellicule',
    ])
  })

  it('garde le média récupérable quand un déplacement échoue', async () => {
    configurationComplete()
    let echoue = false
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
          return echoue
            ? Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response)
            : json({})
        }
        return json({ value: [elementGraph({ id: 'a', name: 'a.jpg' })] })
      }),
    )
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeEnabled(),
    )

    echoue = true
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))

    expect(await screen.findByText(/The move failed/)).toBeInTheDocument()
    // L'échec ne doit pas oublier le média : l'annulation reste possible.
    expect(screen.getByRole('button', { name: 'Cancel last action' })).toBeEnabled()
  })

  it('refuse un déplacement vers un autre OneDrive avec un message lisible', async () => {
    enregistrer({
      source: dossier('Pellicule'),
      poubelle: {
        id: 'Corbeille',
        driveId: 'autre-drive',
        nom: 'Corbeille',
        chemin: 'Partagé / Corbeille',
        titre: 'Corbeille',
      },
      gauche: dossier('Vacances'),
    })
    vi.stubGlobal('fetch', simulerGraphEtDeplacements([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/another OneDrive/)).toBeInTheDocument()
  })
})

describe('swipe et clavier', () => {
  /** Configuration avec les quatre directions, pour éprouver chaque sens. */
  function quatreDirections() {
    enregistrer({
      source: dossier('Pellicule'),
      poubelle: dossier('Corbeille'),
      gauche: dossier('Vacances'),
      droite: dossier('Famille'),
      haut: dossier('Paysages'),
      bas: dossier('Papiers'),
    })
  }

  /**
   * jsdom ne connaît pas `PointerEvent` : `fireEvent.pointerDown` produit alors
   * un événement sans `clientX` ni `clientY`, et le geste serait toujours vu
   * comme immobile. On construit donc un `MouseEvent`, qui porte bien les
   * coordonnées, avec le type d'un événement de pointeur.
   */
  function evenementPointeur(type: string, x: number, y: number) {
    const evenement = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
    Object.defineProperty(evenement, 'pointerId', { value: 1 })
    return evenement
  }

  function carteAffichee() {
    return document.querySelector('.tri__carte') as HTMLElement
  }

  /** Fait glisser la carte de (dx, dy) pixels, puis relâche. */
  function glisser(dx: number, dy: number) {
    const carte = carteAffichee()
    fireEvent(carte, evenementPointeur('pointerdown', 200, 400))
    fireEvent(carte, evenementPointeur('pointermove', 200 + dx, 400 + dy))
    fireEvent(carte, evenementPointeur('pointerup', 200 + dx, 400 + dy))
  }

  /**
   * Laisse les promesses en attente se terminer. Indispensable pour affirmer
   * qu'un déplacement n'a *pas* eu lieu : sans cette pause, l'assertion passe
   * avant même que la requête ait eu le temps de partir, et le test resterait
   * vert quel que soit le comportement.
   */
  async function laisserPartirLesRequetes() {
    await act(async () => {
      await new Promise((resoudre) => setTimeout(resoudre, 0))
    })
  }

  it('range le média dans le dossier de gauche quand on swipe à gauche', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    glisser(-150, 0)

    expect(await screen.findByAltText('b.jpg')).toBeInTheDocument()
    const deplacements = deplacementsDemandes(fetchSimule)
    expect(deplacements).toHaveLength(1)
    expect(deplacements[0].url).toContain('/items/a')
    expect(deplacements[0].corps.parentReference.id).toBe('Vacances')
  })

  it('choisit le dossier du haut quand on swipe vers le haut', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    glisser(0, -150)

    await screen.findByAltText('b.jpg')
    expect(deplacementsDemandes(fetchSimule)[0].corps.parentReference.id).toBe('Paysages')
  })

  it('laisse le média en place quand le geste est trop court', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    glisser(-40, 0)
    await laisserPartirLesRequetes()

    expect(screen.getByAltText('a.jpg')).toBeInTheDocument()
    expect(deplacementsDemandes(fetchSimule)).toHaveLength(0)
  })

  it('ne fait rien quand on swipe vers une direction sans dossier', async () => {
    // Seule la gauche est configurée : le geste vers la droite n'a pas de cible.
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    glisser(150, 0)
    await laisserPartirLesRequetes()

    expect(screen.getByAltText('a.jpg')).toBeInTheDocument()
    expect(deplacementsDemandes(fetchSimule)).toHaveLength(0)
  })

  it("n'affiche aucun bouton pour une direction sans dossier", async () => {
    // Seule la gauche est configurée : les trois autres bords restent nus,
    // plutôt que d'afficher une pastille qui ne ferait rien.
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })]))
    const { container } = afficher()
    await screen.findByAltText('a.jpg')

    expect(container.querySelectorAll('.tri__bord')).toHaveLength(1)
    expect(container.querySelector('.tri__bord--gauche')).not.toBeNull()
    expect(container.querySelector('.tri__bord--droite')).toBeNull()
  })

  it('annonce le dossier visé pendant le geste, une fois le seuil franchi', async () => {
    quatreDirections()
    vi.stubGlobal('fetch', simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })]))
    afficher()
    await screen.findByAltText('a.jpg')

    // On lit l'annonce posée sur la photo, et non la pastille du bord, qui
    // porte le même titre.
    const annonce = () => document.querySelector('.tri__cible-titre')?.textContent ?? null

    const carte = carteAffichee()
    fireEvent(carte, evenementPointeur('pointerdown', 200, 400))
    fireEvent(carte, evenementPointeur('pointermove', 160, 400))

    expect(annonce()).toBeNull()

    fireEvent(carte, evenementPointeur('pointermove', 50, 400))

    expect(annonce()).toBe('Vacances')
  })

  it('remet la carte droite quand le geste est abandonné', async () => {
    quatreDirections()
    vi.stubGlobal('fetch', simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })]))
    afficher()
    await screen.findByAltText('a.jpg')

    const carte = carteAffichee()
    fireEvent(carte, evenementPointeur('pointerdown', 200, 400))
    fireEvent(carte, evenementPointeur('pointermove', 120, 400))
    expect(carte.style.transform).not.toContain('translate(0px, 0px)')

    fireEvent(carte, evenementPointeur('pointercancel', 120, 400))

    expect(carte.style.transform).toContain('translate(0px, 0px)')
  })

  it('range le média avec les flèches du clavier', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.keyboard('{ArrowDown}')

    await screen.findByAltText('b.jpg')
    expect(deplacementsDemandes(fetchSimule)[0].corps.parentReference.id).toBe('Papiers')
  })

  it('ignore une flèche dont la direction n’a pas de dossier', async () => {
    configurationComplete()
    const fetchSimule = simulerGraphEtDeplacements([elementGraph({ id: 'a', name: 'a.jpg' })])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.keyboard('{ArrowUp}')
    await laisserPartirLesRequetes()

    expect(screen.getByAltText('a.jpg')).toBeInTheDocument()
    expect(deplacementsDemandes(fetchSimule)).toHaveLength(0)
  })

  it('permet aussi de cliquer la pastille d’une direction', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Famille' }))

    await screen.findByAltText('b.jpg')
    expect(deplacementsDemandes(fetchSimule)[0].corps.parentReference.id).toBe('Famille')
  })

  it('rend le média swipé récupérable par Cancel', async () => {
    quatreDirections()
    const fetchSimule = simulerGraphEtDeplacements([
      elementGraph({ id: 'a', name: 'a.jpg' }),
      elementGraph({ id: 'b', name: 'b.jpg' }),
    ])
    vi.stubGlobal('fetch', fetchSimule)
    afficher()
    await screen.findByAltText('a.jpg')

    glisser(-150, 0)
    await screen.findByAltText('b.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel last action' }))

    expect(await screen.findByAltText('a.jpg')).toBeInTheDocument()
    expect(deplacementsDemandes(fetchSimule)[1].corps.parentReference.id).toBe('Pellicule')
  })
})

describe('fin et cas limites', () => {
  it('signale un dossier sans photo ni vidéo', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([]))
    afficher()

    expect(await screen.findByText(/contains no photos or videos/)).toBeInTheDocument()
  })

  it('écarte les fichiers qui ne sont ni image ni vidéo', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      simulerGraph([
        elementGraph({ id: 'doc', name: 'notes.pdf', file: { mimeType: 'application/pdf' } }),
      ]),
    )
    afficher()

    expect(await screen.findByText(/contains no photos or videos/)).toBeInTheDocument()
  })

  it('annonce la fin du tri après le dernier média', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(await screen.findByText('Sorting complete')).toBeInTheDocument()
    expect(screen.getByText('1 item reviewed.')).toBeInTheDocument()
  })

  it('permet de repartir du premier média après la fin', async () => {
    configurationComplete()
    vi.stubGlobal('fetch', simulerGraph([elementGraph({ id: 'a' })]))
    afficher()
    await screen.findByAltText('photo.jpg')
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Review again' }))

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

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByAltText('photo.jpg')).toBeInTheDocument()
  })

  it('propose de se reconnecter quand la session a expiré', async () => {
    configurationComplete()
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'session expirée'),
    )
    afficher()

    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
  })

  it('affiche une erreur réseau sans proposer de se reconnecter', async () => {
    configurationComplete()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('réseau injoignable'))),
    )
    afficher()

    expect(await screen.findByText(/réseau injoignable/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in again' })).not.toBeInTheDocument()
  })
})
