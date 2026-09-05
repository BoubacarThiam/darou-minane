import { Component } from 'react'

/**
 * Filet de sécurité : une exception de rendu affiche un message lisible
 * plutôt qu'un écran blanc — l'application est utilisée debout dans la
 * boutique, il faut au moins pouvoir recharger.
 */
export class Garde extends Component {
  constructor(props) {
    super(props)
    this.state = { erreur: null }
  }

  static getDerivedStateFromError(erreur) {
    return { erreur }
  }

  componentDidCatch(erreur, infos) {
    console.error('Erreur de rendu', erreur, infos)
  }

  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <div className="etat-vide" style={{ padding: 40 }}>
        <strong>Une erreur est survenue sur cet écran.</strong>
        <p className="texte-petit">Rechargez la page. Si cela se reproduit, notez ce que vous faisiez.</p>
        <button
          type="button"
          className="bouton"
          style={{ marginTop: 16 }}
          onClick={() => window.location.reload()}
        >
          Recharger
        </button>
      </div>
    )
  }
}
