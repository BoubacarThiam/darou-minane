import { Link } from 'react-router-dom'
import { fourchettePrix } from '../format.js'

/**
 * Vignette de catalogue : la photo porte tout, le texte reste discret.
 *
 * `prioritaire` sert aux cartes de la première rangée. Le chargement différé
 * est un gain sur les cinquante suivantes, mais une perte sur celles déjà à
 * l'écran : sur une connexion lente, il retarde la seule image que le client
 * voit vraiment. Ces cartes-là sont donc chargées tout de suite.
 */
export function CarteProduit({ produit, prioritaire = false }) {
  return (
    <Link className="vignette" to={`/p/${produit.slug}`}>
      <div className="vignette__photo">
        {produit.image ? (
          <img
            src={produit.image}
            alt={produit.nom}
            loading={prioritaire ? 'eager' : 'lazy'}
            fetchpriority={prioritaire ? 'high' : 'auto'}
            decoding="async"
          />
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
