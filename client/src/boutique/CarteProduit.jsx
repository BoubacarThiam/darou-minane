import { Link } from 'react-router-dom'
import { fourchettePrix } from '../format.js'

/** Vignette de catalogue : la photo porte tout, le texte reste discret. */
export function CarteProduit({ produit }) {
  return (
    <Link className="vignette" to={`/p/${produit.slug}`}>
      <div className="vignette__photo">
        {produit.image ? (
          <img src={produit.image} alt={produit.nom} loading="lazy" decoding="async" />
        ) : (
          <span className="vignette__absente" aria-hidden="true" />
        )}
        {!produit.en_stock && <span className="vignette__rupture">Bientôt de retour</span>}
      </div>
      <p className="vignette__nom">{produit.nom}</p>
      <p className="vignette__prix">{fourchettePrix(produit.prix_min, produit.prix_max)}</p>
    </Link>
  )
}
