import { useMsal } from '@azure/msal-react'
import { Fragment, useEffect, useState } from 'react'
import { estInteractionRequise, recupererJetonAcces, SCOPES } from '../auth/msal'
import type { DossierOneDrive } from '../graph/dossiers'
import { listerDossiersRacine, listerSousDossiers } from '../graph/dossiers'
import type { DossierChoisi } from './configuration'

/** Une étape du fil d'Ariane. `id` vaut `null` pour la racine du OneDrive. */
type EtapeChemin = {
  id: string | null
  driveId: string | null
  nom: string
}

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'prete'; dossiers: DossierOneDrive[] }
  | { statut: 'sessionExpiree' }
  | { statut: 'erreur'; message: string }

const RACINE: EtapeChemin = { id: null, driveId: null, nom: 'OneDrive' }

/**
 * Explorateur de dossiers OneDrive : on descend dans l'arborescence, on remonte
 * par le fil d'Ariane, et on valide le dossier courant.
 *
 * Seuls les dossiers sont affichés — les fichiers seront listés plus tard, au
 * moment du tri.
 */
export default function ExplorateurDossiers({
  onChoisir,
}: {
  onChoisir: (dossier: DossierChoisi) => void
}) {
  const { instance, accounts } = useMsal()
  const compte = accounts[0]
  const idCompte = compte?.homeAccountId
  const [chemin, setChemin] = useState<EtapeChemin[]>([RACINE])
  const [etat, setEtat] = useState<EtatListe>({ statut: 'chargement' })
  const [tentative, setTentative] = useState(0)

  const dossierCourant = chemin[chemin.length - 1]
  const idCourant = dossierCourant.id
  const driveCourant = dossierCourant.driveId

  useEffect(() => {
    if (!compte) {
      setEtat({
        statut: 'erreur',
        message: 'Sign in to browse your folders.',
      })
      return
    }

    let annule = false
    setEtat({ statut: 'chargement' })

    recupererJetonAcces(instance, compte)
      .then((jeton) =>
        idCourant === null || driveCourant === null
          ? listerDossiersRacine(jeton)
          : listerSousDossiers(jeton, driveCourant, idCourant),
      )
      .then((dossiers) => {
        if (!annule) {
          setEtat({ statut: 'prete', dossiers })
        }
      })
      .catch((erreur: unknown) => {
        if (annule) {
          return
        }
        setEtat(
          estInteractionRequise(erreur)
            ? { statut: 'sessionExpiree' }
            : { statut: 'erreur', message: decrireErreur(erreur) },
        )
      })

    return () => {
      annule = true
    }
  }, [instance, idCompte, idCourant, driveCourant, tentative])

  const ouvrir = (dossier: DossierOneDrive) =>
    setChemin([...chemin, { id: dossier.id, driveId: dossier.driveId, nom: dossier.nom }])

  const remonter = (index: number) => setChemin(chemin.slice(0, index + 1))

  const reconnecter = () =>
    instance
      .loginRedirect({ scopes: SCOPES })
      .catch((erreur: unknown) => setEtat({ statut: 'erreur', message: decrireErreur(erreur) }))

  const choisir = () => {
    if (idCourant === null || driveCourant === null) {
      return
    }
    onChoisir({
      id: idCourant,
      driveId: driveCourant,
      nom: dossierCourant.nom,
      chemin: chemin.map((etape) => etape.nom).join(' / '),
    })
  }

  return (
    <section className="explorateur">
      <nav className="fil-ariane" aria-label="Folder path">
        {chemin.map((etape, index) => (
          <Fragment key={etape.id ?? 'racine'}>
            {index > 0 ? (
              <span className="fil-ariane__separateur" aria-hidden="true">
                /
              </span>
            ) : null}
            <button
              type="button"
              className="fil-ariane__etape"
              onClick={() => remonter(index)}
              aria-current={index === chemin.length - 1 ? 'page' : undefined}
            >
              {etape.nom}
            </button>
          </Fragment>
        ))}
      </nav>

      {etat.statut === 'chargement' ? <p className="note">Loading folders…</p> : null}

      {etat.statut === 'sessionExpiree' ? (
        <div className="pile">
          <p className="note">
            Your Microsoft session has expired, or TriPhoto needs a new authorisation.
          </p>
          <button type="button" className="action action--discrete" onClick={reconnecter}>
            Sign in again
          </button>
        </div>
      ) : null}

      {etat.statut === 'erreur' ? (
        <div className="pile">
          <p className="note">{etat.message}</p>
          <button
            type="button"
            className="action action--discrete"
            onClick={() => setTentative(tentative + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {etat.statut === 'prete' && etat.dossiers.length === 0 ? (
        <p className="note">This folder has no subfolder.</p>
      ) : null}

      {etat.statut === 'prete' && etat.dossiers.length > 0 ? (
        <ul className="liste-dossiers">
          {etat.dossiers.map((dossier) => (
            <li key={`${dossier.driveId}:${dossier.id}`}>
              <button type="button" className="dossier" onClick={() => ouvrir(dossier)}>
                <span className="dossier__nom">{dossier.nom}</span>
                <span className="dossier__compte">
                  {dossier.partage ? 'shared · ' : ''}
                  {decrireContenu(dossier.nombreEnfants)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="action" onClick={choisir} disabled={idCourant === null}>
        Choose this folder
      </button>

      {idCourant === null ? (
        <p className="note">
          Open a folder to be able to choose it. A folder shared by someone else only shows up here
          after an “Add shortcut to My files” from onedrive.live.com.
        </p>
      ) : null}
    </section>
  )
}

function decrireContenu(nombreEnfants: number): string {
  if (nombreEnfants === 0) {
    return 'empty'
  }
  return nombreEnfants === 1 ? '1 item' : `${nombreEnfants} items`
}

function decrireErreur(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'unknown reason'
  return `Unable to read your OneDrive folders: ${detail}`
}
