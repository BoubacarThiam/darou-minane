export function Chargement({ texte = 'Chargement…' }) {
  return (
    <p className="chargement" role="status">
      {texte}
    </p>
  )
}

/**
 * Squelettes de chargement : on dessine la forme de ce qui arrive plutôt
 * qu'un sablier au milieu du vide. Sur une connexion lente, la page garde
 * sa structure et ne saute pas quand les données tombent.
 */
export function SqueletteGrille({ nombre = 8 }) {
  return (
    <div className="grille-produits" aria-hidden="true">
      {Array.from({ length: nombre }, (_, index) => (
        <div key={index}>
          <div className="squelette squelette--photo" />
          <div className="squelette squelette--texte" />
          <div className="squelette squelette--texte squelette--court" />
        </div>
      ))}
    </div>
  )
}

export function SqueletteListe({ nombre = 6, avecVignette = true }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: nombre }, (_, index) => (
        <div className="squelette--ligne" key={index}>
          {avecVignette && <div className="squelette squelette--vignette-carree" />}
          <div style={{ flex: 1 }}>
            <div className="squelette squelette--texte" style={{ width: '55%' }} />
            <div className="squelette squelette--texte squelette--court" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SqueletteBloc({ hauteur = 120 }) {
  return <div className="squelette squelette--bloc" style={{ height: hauteur }} aria-hidden="true" />
}

/** Annonce le chargement aux lecteurs d'écran, sans rien afficher. */
export function AnnonceChargement({ texte = 'Chargement en cours…' }) {
  return (
    <p className="sr-seulement" role="status">
      {texte}
    </p>
  )
}

export function EtatVide({ titre, children }) {
  return (
    <div className="etat-vide">
      <strong>{titre}</strong>
      {children}
    </div>
  )
}

export function Message({ ton = 'info', children }) {
  if (!children) return null
  return (
    <p className={`message message--${ton}`} role={ton === 'erreur' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages, total } = pagination
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="bouton bouton--discret bouton--petit"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        Précédent
      </button>
      <span>
        Page {page} sur {pages} · {total} résultat{total > 1 ? 's' : ''}
      </span>
      <button
        type="button"
        className="bouton bouton--discret bouton--petit"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
      >
        Suivant
      </button>
    </nav>
  )
}
