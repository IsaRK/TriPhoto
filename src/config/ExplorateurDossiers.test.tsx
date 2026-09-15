import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExplorateurDossiers from './ExplorateurDossiers'

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

function simulerGraph(contenus: Record<string, ReturnType<typeof dossier>[]>) {
  return vi.fn((url: string) => {
    const cle = url.includes('/root/children')
      ? 'racine'
      : decodeURIComponent(url.split('/items/')[1].split('/children')[0])
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ value: contenus[cle] ?? [] }),
    } as Response)
  })
}

beforeEach(() => {
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
      simulerGraph({ racine: [dossier('1', 'Photos')], '1': [dossier('2', '2024')] }),
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
      simulerGraph({ racine: [dossier('1', 'Photos')], '1': [dossier('2', '2024')] }),
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
      simulerGraph({ racine: [dossier('1', 'Photos')], '1': [dossier('2', '2024')] }),
    )

    render(<ExplorateurDossiers onChoisir={onChoisir} />)
    await userEvent.click(await screen.findByText('Photos'))
    await userEvent.click(await screen.findByText('2024'))
    await userEvent.click(await screen.findByRole('button', { name: 'Choisir ce dossier' }))

    expect(onChoisir).toHaveBeenCalledWith({
      id: '2',
      nom: '2024',
      chemin: 'OneDrive / Photos / 2024',
    })
  })

  it('signale un dossier sans sous-dossier', async () => {
    vi.stubGlobal('fetch', simulerGraph({ racine: [dossier('1', 'Photos')], '1': [] }))

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByText('Photos'))

    expect(await screen.findByText('Ce dossier ne contient aucun sous-dossier.')).toBeInTheDocument()
  })

  it('affiche une erreur lisible et permet de réessayer', async () => {
    const fetchSimule = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ value: [dossier('1', 'Photos')] }),
      } as Response)
    vi.stubGlobal('fetch', fetchSimule)

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Photos')).toBeInTheDocument()
    expect(fetchSimule).toHaveBeenCalledTimes(2)
  })

  it('propose de se reconnecter quand la session a expiré', async () => {
    instanceSimulee.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'Consentement à redonner'),
    )
    vi.stubGlobal('fetch', vi.fn())

    render(<ExplorateurDossiers onChoisir={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Se reconnecter' }))

    expect(screen.getByText('Votre session Microsoft a expiré.')).toBeInTheDocument()
    expect(instanceSimulee.loginRedirect).toHaveBeenCalledTimes(1)
  })

  it('ignore la réponse d’un dossier qu’on a déjà quitté', async () => {
    let repondrePourPhotos = () => {}
    const fetchSimule = vi.fn((url: string) => {
      if (url.includes('/root/children')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ value: [dossier('1', 'Photos')] }),
        } as Response)
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
