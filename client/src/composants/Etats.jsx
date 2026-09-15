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

/**
 * Pastilles de rayon en attente. Sans elles, la barre de filtres naît avec la
 * seule pastille « Tout », puis les rayons tombent et la font passer à deux
 * lignes : la grille de produits descend de 98 px sous le pouce du client.
 */
export function SquelettePuces({ nombre = 3 }) {
  // Largeurs calées sur les noms de rayons réels : une pastille fantôme plus
  // étroite que la vraie ferait retomber la ligne au moment du remplacement.
  const largeurs = ['5.5rem', '5.5rem', '5.7rem', '5rem']
  return (
    <>
      {Array.from({ length: nombre }, (_, index) => (
        <span
          key={index}
          className="squelette squelette--puce"
          style={{ width: largeurs[index % largeurs.length] }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}

/** Forme d'une fiche produit : une photo carrée, un titre, un prix, un bouton. */
export function SqueletteFiche() {
  return (
    <div className="fiche" aria-hidden="true">
      <div className="squelette squelette--photo-fiche" />
      <div className="fiche__infos">
        <div className="squelette squelette--texte" style={{ width: '70%', height: 26 }} />
        <div className="squelette squelette--texte" style={{ width: '40%', height: 22 }} />
        <div className="squelette squelette--bloc" style={{ height: 52 }} />
        <div className="squelette squelette--texte squelette--court" />
        {/* Les trois lignes de la fiche technique : sans elles, la colonne
            réservée est plus courte que la vraie et le pied de page saute. */}
        <div className="squelette squelette--bloc" style={{ height: 138 }} />
      </div>
    </div>
  )
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
