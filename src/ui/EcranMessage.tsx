import type { ReactNode } from 'react'

/**
 * Écran plein cadre pour les états où l'app n'a rien d'autre à montrer :
 * démarrage en cours, configuration manquante.
 */
export default function EcranMessage({
  titre,
  message,
  children,
}: {
  titre: string
  message?: string
  children?: ReactNode
}) {
  return (
    <main className="ecran">
      <div className="contenu">
        <h1 className="titre">{titre}</h1>
        {message ? <p className="note">{message}</p> : null}
        {children}
      </div>
    </main>
  )
}
