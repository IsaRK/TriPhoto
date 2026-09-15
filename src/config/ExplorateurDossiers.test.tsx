import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExplorateurDossiers from './ExplorateurDossiers'
import { oublierIdDeMonDrive } from '../graph/dossiers'

const instanceSimulee = {
  acquireTokenSilent: vi.fn(),
  loginRedirect: vi.fn(),
}

const compte = { homeAccountId: 'compte-1', username: 'alice@outlook.com' }

// `accounts` renvoie un nouvel objet à chaque rendu, comme MSAL peut le faire :
// le composant doit dépendre de l'identifiant du compte, pas de l'objet.
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: instanceSimulee, accounts: [{ ...compte }], inProgress: 'none' }),
}))

vi.mock('@azure/msal-browser', () => ({
  InteractionRequiredAuthError: class extends Error {},
  InteractionStatus: { Startup: 'startup', None: 'none' },
}))

function dossier(id: string, nom: string, childCount = 2) {
  return { id, name: nom, folder: { childCount } }
}

function raccourci(nom: string, driveId: string, id: string) {
  return {
    id: 'raccourci-local',
    name: nom,
    remoteItem: { id, folder: { childCount: 4 }, parentReference: { driveId } },
  }
}

function json(donnees: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: async () => donnees } as Response)
}

/**
 * Route les appels Graph vers le bon contenu. Les clés sont `racine` ou
 * `{driveId}/{idDossier}`, pour qu'un mauvais drive donne un dossier vide plutôt
 * qu'un test faussement vert.
 */
function simulerGraph(contenus: Record<string, object[]>) {
  return vi.fn((url: string) => {
    if (url.includes('/me/drive?')) {
      return json({ id: 'mon-drive' })
    }
    if (url.includes('/root/children')) {
      return json({ value: contenus['racine'] ?? [] })
    }
    const driveId = url.split('/drives/')[1].split('/items/')[0]
    const idDossier = decodeURIComponent(url.split('/items/')[1].split('/children')[0])
    return json({ value: contenus[`${driveId}/${idDossier}`] ?? [] })
  })
}

beforeEach(() => {
  oublierIdDeMonDrive()
  instanceSimulee.acquireTokenSilent.mockResolvedValue({ accessToken: 'jeton-de-test' })
  instanceSimulee.loginRedirect.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('explorateur de dossiers', () => {
  it('affiche les dossiers de la racine du OneDrive', async () => {
    vi.stubGlobal('fetch', simulerGraph({ racine: [dossier('1', 'Photos')] }))

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)

    expect(await screen.findByText('Photos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OneDrive' })).toHaveAttribute('aria-current', 'page')
  })

  it('descend dans un sous-dossier et allonge le fil d’Ariane', async () => {
    vi.stubGlobal(
      'fetch',
      simulerGraph({ racine: [dossier('1', 'Photos')], 'mon-drive/1': [dossier('2', '2024')] }),
    )

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByText('Photos'))

    expect(await screen.findByText('2024')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OneDrive' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-current', 'page')
  })

  it('remonte à un dossier parent depuis le fil d’Ariane', async () => {
    vi.stubGlobal(
      'fetch',
      simulerGraph({ racine: [dossier('1', 'Photos')], 'mon-drive/1': [dossier('2', '2024')] }),
    )

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByText('Photos'))
    await screen.findByText('2024')
    await userEvent.click(screen.getByRole('button', { name: 'OneDrive' }))

    expect(await screen.findByText('Photos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OneDrive' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('2024')).not.toBeInTheDocument()
  })

  it('interdit de choisir la racine du OneDrive', async () => {
    vi.stubGlobal('fetch', simulerGraph({ racine: [dossier('1', 'Photos')] }))

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)

    await screen.findByText('Photos')
    expect(screen.getByRole('button', { name: 'Choisir ce dossier' })).toBeDisabled()
  })

  it('renvoie le dossier courant avec son chemin lisible', async () => {
    const onChoisir = vi.fn()
    vi.stubGlobal(
      'fetch',
      simulerGraph({ racine: [dossier('1', 'Photos')], 'mon-drive/1': [dossier('2', '2024')] }),
    )

    render(<ExplorateurDossiers onChoisir={onChoisir} />)
    await userEvent.click(await screen.findByText('Photos'))
    await userEvent.click(await screen.findByText('2024'))
    await userEvent.click(await screen.findByRole('button', { name: 'Choisir ce dossier' }))

    expect(onChoisir).toHaveBeenCalledWith({
      id: '2',
      driveId: 'mon-drive',
      nom: '2024',
      chemin: 'OneDrive / Photos / 2024',
    })
  })

  it('ouvre un dossier partagé dans le drive de la personne qui partage', async () => {
    const onChoisir = vi.fn()
    const fetchSimule = simulerGraph({
      racine: [raccourci('Album famille', 'drive-de-paul', 'dossier-distant')],
      'drive-de-paul/dossier-distant': [dossier('9', 'Juillet')],
    })
    vi.stubGlobal('fetch', fetchSimule)

    render(<ExplorateurDossiers onChoisir={onChoisir} />)
    await userEvent.click(await screen.findByText('Album famille'))
    await screen.findByText('Juillet')
    await userEvent.click(screen.getByRole('button', { name: 'Choisir ce dossier' }))

    const urls = fetchSimule.mock.calls.map(([url]) => url as string)
    expect(urls.some((url) => url.includes('/drives/drive-de-paul/items/dossier-distant/children'))).toBe(true)
    expect(onChoisir).toHaveBeenCalledWith({
      id: 'dossier-distant',
      driveId: 'drive-de-paul',
      nom: 'Album famille',
      chemin: 'OneDrive / Album famille',
    })
  })

  it('reste dans le drive partagé en descendant d’un niveau de plus', async () => {
    const onChoisir = vi.fn()
    const fetchSimule = simulerGraph({
      racine: [raccourci('Album famille', 'drive-de-paul', 'dossier-distant')],
      'drive-de-paul/dossier-distant': [dossier('9', 'Juillet')],
      'drive-de-paul/9': [],
    })
    vi.stubGlobal('fetch', fetchSimule)

    render(<ExplorateurDossiers onChoisir={onChoisir} />)
    await userEvent.click(await screen.findByText('Album famille'))
    await userEvent.click(await screen.findByText('Juillet'))
    await screen.findByText('Ce dossier ne contient aucun sous-dossier.')
    await userEvent.click(screen.getByRole('button', { name: 'Choisir ce dossier' }))

    expect(onChoisir).toHaveBeenCalledWith({
      id: '9',
      driveId: 'drive-de-paul',
      nom: 'Juillet',
      chemin: 'OneDrive / Album famille / Juillet',
    })
  })

  it('signale les dossiers qui ne sont pas dans notre OneDrive', async () => {
    vi.stubGlobal(
      'fetch',
      simulerGraph({
        racine: [
          dossier('1', 'Photos'),
          raccourci('Album famille', 'drive-de-paul', 'dossier-distant'),
        ],
      }),
    )

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Album famille/ })).toHaveTextContent(
      'partagé',
    )
    expect(screen.getByRole('button', { name: /Photos/ })).not.toHaveTextContent('partagé')
  })

  it('signale un dossier sans sous-dossier', async () => {
    vi.stubGlobal('fetch', simulerGraph({ racine: [dossier('1', 'Photos')], 'mon-drive/1': [] }))

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByText('Photos'))

    expect(await screen.findByText('Ce dossier ne contient aucun sous-dossier.')).toBeInTheDocument()
  })

  it('affiche une erreur lisible et permet de réessayer', async () => {
    let echecsRestants = 1
    const fetchSimule = vi.fn((url: string) => {
      if (url.includes('/me/drive?')) {
        return json({ id: 'mon-drive' })
      }
      if (echecsRestants > 0) {
        echecsRestants -= 1
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) } as Response)
      }
      return json({ value: [dossier('1', 'Photos')] })
    })
    vi.stubGlobal('fetch', fetchSimule)

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Photos')).toBeInTheDocument()
  })

  it('propose de se reconnecter quand la session a expiré', async () => {
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'Consentement à redonner'),
    )
    vi.stubGlobal('fetch', vi.fn())

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Se reconnecter' }))

    expect(
      screen.getByText("Votre session Microsoft a expiré, ou TriPhoto a besoin d'une nouvelle autorisation."),
    ).toBeInTheDocument()
    expect(instanceSimulee.loginRedirect).toHaveBeenCalledTimes(1)
  })

  it('ignore la réponse d’un dossier qu’on a déjà quitté', async () => {
    let repondrePourPhotos = () => {}
    const fetchSimule = vi.fn((url: string) => {
      if (url.includes('/me/drive?')) {
        return json({ id: 'mon-drive' })
      }
      if (url.includes('/root/children')) {
        return json({ value: [dossier('1', 'Photos')] })
      }
      return new Promise<Response>((resoudre) => {
        repondrePourPhotos = () =>
          resoudre({
            ok: true,
            status: 200,
            json: async () => ({ value: [dossier('2', '2024')] }),
          } as Response)
      })
    })
    vi.stubGlobal('fetch', fetchSimule)

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByText('Photos'))
    await userEvent.click(screen.getByRole('button', { name: 'OneDrive' }))
    repondrePourPhotos()

    expect(await screen.findByText('Photos')).toBeInTheDocument()
    expect(screen.queryByText('2024')).not.toBeInTheDocument()
  })
})
