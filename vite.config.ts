import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
// defineConfig vient de vitest/config (et non de vite) pour que la section `test` soit typée.
import { defineConfig } from 'vitest/config'

// `npm run dev` sert l'application sur localhost en clair, ce qui suffit au
// quotidien. `npm run dev:mobile` passe par ici avec le mode « mobile » et
// ajoute HTTPS : Entra n'accepte une URI de redirection en clair que sur
// localhost, donc un téléphone qui viendrait sur http://192.168.x.x se ferait
// refuser la connexion Microsoft.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'mobile' ? [react(), basicSsl()] : [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
}))
