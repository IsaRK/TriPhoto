import { describe, expect, it } from 'vitest'
import { calculerRedirectUri } from './msal'

/**
 * L'URI de redirection est le point le plus fragile du déploiement : Entra la
 * compare caractère par caractère à celles déclarées dans l'app registration.
 * Une barre oblique en trop et la connexion échoue avec un message obscur.
 */
describe('calculerRedirectUri', () => {
  it("renvoie l'origine seule quand le site est à la racine du domaine", () => {
    // Cas du développement : c'est « http://localhost:5173 », sans barre
    // oblique finale, qui est déclaré dans l'app registration.
    expect(calculerRedirectUri('/', 'http://localhost:5173')).toBe('http://localhost:5173')
  })

  it('garde le sous-dossier quand le site est publié sur GitHub Pages', () => {
    // Sans le sous-dossier, Microsoft renverrait vers la page d'accueil du
    // compte GitHub, c'est-à-dire hors de l'application.
    expect(calculerRedirectUri('/TriPhoto/', 'https://isark.github.io')).toBe(
      'https://isark.github.io/TriPhoto/',
    )
  })

  it("suit l'adresse réseau utilisée depuis un téléphone", () => {
    expect(calculerRedirectUri('/', 'https://192.168.1.12:5173')).toBe('https://192.168.1.12:5173')
  })
})
