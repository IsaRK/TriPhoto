import type { IPublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import EcranMessage from '../ui/EcranMessage'
import { MESSAGE_CLIENT_ID_MANQUANT, creerInstanceMsal } from './msal'

type EtatDemarrage =
  | { statut: 'chargement' }
  | { statut: 'pret'; instance: IPublicClientApplication }
  | { statut: 'erreur'; message: string }

/**
 * Prépare MSAL avant d'afficher l'application : sans cette étape, le retour de
 * redirection ne serait pas encore traité au premier rendu.
 */
export default function DemarrageAuth({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatDemarrage>({ statut: 'chargement' })

  useEffect(() => {
    let annule = false

    creerInstanceMsal()
      .then((instance) => {
        if (!annule) {
          setEtat({ statut: 'pret', instance })
        }
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ statut: 'erreur', message: decrireErreur(erreur) })
        }
      })

    return () => {
      annule = true
    }
  }, [])

  if (etat.statut === 'chargement') {
    return <EcranMessage titre="TriPhoto" message="Démarrage…" />
  }

  if (etat.statut === 'erreur') {
    // Le client ID manquant demande une action de configuration ; tout le reste
    // (réseau, retour de redirection invalide) est souvent passager.
    if (etat.message === MESSAGE_CLIENT_ID_MANQUANT) {
      return <EcranMessage titre="Configuration incomplète" message={etat.message} />
    }

    return (
      <EcranMessage titre="Le démarrage a échoué" message={etat.message}>
        <button type="button" className="action" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </EcranMessage>
    )
  }

  return <MsalProvider instance={etat.instance}>{children}</MsalProvider>
}

function decrireErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "L'initialisation de la connexion a échoué."
}
