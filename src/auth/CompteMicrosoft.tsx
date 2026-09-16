import { InteractionStatus } from '@azure/msal-browser'
import { useMsal } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import type { ProfilUtilisateur } from '../graph/profil'
import { recupererProfil } from '../graph/profil'
import { SCOPES, estInteractionRequise, recupererJetonAcces } from './msal'

type EtatCompte =
  | { statut: 'deconnecte' }
  | { statut: 'chargement' }
  | { statut: 'connecte'; profil: ProfilUtilisateur }
  | { statut: 'sessionExpiree' }
  | { statut: 'erreur'; message: string }

/**
 * Bloc « compte Microsoft » de l'écran d'accueil : connexion, déconnexion, et
 * nom du compte connecté.
 *
 * Le nom vient d'un vrai appel Graph `GET /me` : s'il s'affiche, c'est que le
 * jeton d'accès est valide et accepté par Graph.
 */
export default function CompteMicrosoft() {
  const { instance, accounts, inProgress } = useMsal()
  const compte = accounts[0]
  const idCompte = compte?.homeAccountId
  const [etat, setEtat] = useState<EtatCompte>({ statut: 'deconnecte' })
  const [tentative, setTentative] = useState(0)

  useEffect(() => {
    if (!compte) {
      setEtat({ statut: 'deconnecte' })
      return
    }

    let annule = false
    setEtat({ statut: 'chargement' })

    recupererJetonAcces(instance, compte)
      .then(recupererProfil)
      .then((profil) => {
        if (!annule) {
          setEtat({ statut: 'connecte', profil })
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
    // On dépend de l'identifiant du compte et non de l'objet lui-même : MSAL
    // peut renvoyer un nouvel objet pour le même compte à chaque rendu.
  }, [instance, idCompte, tentative])

  const signalerEchec = (erreur: unknown) =>
    setEtat({ statut: 'erreur', message: decrireErreur(erreur) })

  const connecter = () => instance.loginRedirect({ scopes: SCOPES }).catch(signalerEchec)
  const deconnecter = () => instance.logoutRedirect().catch(signalerEchec)

  // Au tout premier rendu, MsalProvider n'a pas encore relu son cache : sans ce
  // garde, le bouton « Se connecter » apparaîtrait une fraction de seconde alors
  // que l'utilisateur est déjà connecté.
  if (inProgress === InteractionStatus.Startup) {
    return <p className="note">Connexion en cours…</p>
  }

  if (etat.statut === 'deconnecte') {
    return (
      <button type="button" className="action" onClick={connecter}>
        Se connecter avec Microsoft
      </button>
    )
  }

  if (etat.statut === 'chargement') {
    return <p className="note">Connexion en cours…</p>
  }

  if (etat.statut === 'sessionExpiree') {
    return (
      <div className="pile">
        <p className="note">
          Votre session Microsoft a expiré, ou TriPhoto a besoin d'une nouvelle autorisation.
        </p>
        <button type="button" className="action" onClick={connecter}>
          Se reconnecter
        </button>
      </div>
    )
  }

  if (etat.statut === 'erreur') {
    return (
      <div className="pile">
        <p className="note">{etat.message}</p>
        <button type="button" className="action" onClick={() => setTentative(tentative + 1)}>
          Réessayer
        </button>
        <button type="button" className="action action--discrete" onClick={deconnecter}>
          Se déconnecter
        </button>
      </div>
    )
  }

  // Repli sur le compte MSAL : `username` est exactement l'adresse saisie dans la
  // fenêtre de connexion, même quand Graph ne renvoie ni `mail` ni
  // `userPrincipalName`.
  const adresse = etat.profil.email ?? compte?.username ?? null

  return (
    <div className="pile">
      <p className="compte">
        Connecté en tant que <strong>{etat.profil.nom}</strong>
      </p>
      {adresse === null ? null : <p className="compte__adresse">{adresse}</p>}
      <button type="button" className="action action--discrete" onClick={deconnecter}>
        Se déconnecter
      </button>
    </div>
  )
}

function decrireErreur(erreur: unknown): string {
  const detail = erreur instanceof Error ? erreur.message : 'raison inconnue'
  return `Impossible de récupérer votre profil Microsoft : ${detail}`
}
