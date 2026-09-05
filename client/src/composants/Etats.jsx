export function Chargement({ texte = 'Chargement…' }) {
  return (
    <p className="chargement" role="status">
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
