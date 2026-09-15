import { useMsal } from '@azure/msal-react'
import { Fragment, useEffect, useState } from 'react'
import { estInteractionRequise, recupererJetonAcces, SCOPES } from '../auth/msal'
import type { DossierOneDrive } from '../graph/dossiers'
import { listerDossiersRacine, listerSousDossiers } from '../graph/dossiers'

export type DossierChoisi = {
  id: string
  nom: string
  chemin: string
}

/** Une étape du fil d'Ariane. `id` vaut `null` pour la racine du OneDrive. */
type EtapeChemin = {
  id: string | null
  nom: string
}

type EtatListe =
  | { statut: 'chargement' }
  | { statut: 'prete'; dossiers: DossierOneDrive[] }
  | { statut: 'sessionExpiree' }
  | { statut: 'erreur'; message: string }

const RACINE: EtapeChemin = { id: null, nom: 'OneDrive' }

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

  useEffect(() => {
    if (!compte) {
      setEtat({ statut: 'erreur', message: 'Connectez-vous pour parcourir vos dossiers.' })
      return
    }

    let annule = false
    setEtat({ statut: 'chargement' })

    recupererJetonAcces(instance, compte)
      .then((jeton) =>
        idCourant === null ? listerDossiersRacine(jeton) : listerSousDossiers(jeton, idCourant),
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
  }, [instance, idCompte, idCourant, tentative])

  const ouvrir = (dossier: DossierOneDrive) =>
    setChemin([...chemin, { id: dossier.id, nom: dossier.nom }])

  const remonter = (index: number) => setChemin(chemin.slice(0, index + 1))

  const reconnecter = () =>
    instance
      .loginRedirect({ scopes: SCOPES })
      .catch((erreur: unknown) => setEtat({ statut: 'erreur', message: decrireErreur(erreur) }))

  const choisir = () => {
    if (idCourant === null) {
      return
    }
    onChoisir({
      id: idCourant,
      nom: dossierCourant.nom,
      chemin: chemin.map((etape) => etape.nom).join(' / '),
    })
  }

  return (
    <section className="explorateur">
      <nav className="fil-ariane" aria-label="Chemin du dossier">
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

      {etat.statut === 'chargement' ? <p className="note">Chargement des dossiers…</p> : null}

      {etat.statut === 'sessionExpiree' ? (
        <div className="pile">
          <p className="note">Votre session Microsoft a expiré.</p>
          <button type="button" className="action action--discrete" onClick={reconnecter}>
            Se reconnecter
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
            Réessayer
          </button>
        </div>
      ) : null}

      {etat.statut === 'prete' && etat.dossiers.length === 0 ? (
        <p className="note">Ce dossier ne contient aucun sous-dossier.</p>
      ) : null}

      {etat.statut === 'prete' && etat.dossiers.length > 0 ? (
        <ul className="liste-dossiers">
          {etat.dossiers.map((dossier) => (
            <li key={dossier.id}>
              <button type="button" className="dossier" onClick={() => ouvrir(dossier)}>
                <span className="dossier__nom">{dossier.nom}</span>
                <span className="dossier__compte">{decrireContenu(dossier.nombreEnfants)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="action" onClick={choisir} disabled={idCourant === null}>
        Choisir ce dossier
      </button>

      {idCourant === null ? (
        <p className="note">Ouvrez un dossier pour pouvoir le choisir.</p>
      ) : null}
    </section>
  )
}

function decrireContenu(nombreEnfants: number): string {
  if (nombreEnfants === 0) {
    return 'vide'
  }
  return nombreEnfants === 1 ? '1 élément' : `${nombreEnfants} éléments`
}

function decrireErreur(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'raison inconnue'
  return `Impossible de lire vos dossiers OneDrive : ${detail}`
}
