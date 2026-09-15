/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID de l'app registration Entra, renseigné dans .env.local. */
  readonly VITE_MSAL_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
