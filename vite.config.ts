import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
// defineConfig vient de vitest/config (et non de vite) pour que la section `test` soit typée.
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { OPTIONS_PWA } from './src/pwa/configurationPwa.ts'

// GitHub Pages publie le site sous https://<compte>.github.io/TriPhoto/ et non à la
// racine du domaine. Les liens vers les fichiers construits doivent donc commencer par
// /TriPhoto/, sans quoi le navigateur irait les chercher à la racine et ne trouverait
// rien. En développement le site est bien servi à la racine, d'où le `base` différent
// selon que l'on construit ou que l'on développe. Le reste du code n'a pas à connaître
// cette valeur : il lit `import.meta.env.BASE_URL`, que Vite renseigne tout seul.
const BASE_EN_PRODUCTION = '/TriPhoto/'

// `npm run dev` sert l'application sur localhost en clair, ce qui suffit au
// quotidien. `npm run dev:mobile` passe par ici avec le mode « mobile » et
// ajoute HTTPS : Entra n'accepte une URI de redirection en clair que sur
// localhost, donc un téléphone qui viendrait sur http://192.168.x.x se ferait
// refuser la connexion Microsoft.
export default defineConfig(({ command, mode }) => ({
  base: command === 'build' ? BASE_EN_PRODUCTION : '/',
  plugins:
    mode === 'mobile'
      ? [react(), basicSsl(), VitePWA(OPTIONS_PWA)]
      : [react(), VitePWA(OPTIONS_PWA)],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
}))
