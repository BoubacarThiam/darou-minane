import { Link } from 'react-router-dom'
import { fcfa } from '../format.js'
import { usePanier } from '../panier.jsx'
import { useBoutique } from '../boutique.jsx'
import { EtatVide } from '../composants/Etats.jsx'

export default function PagePanier() {
  const { lignes, total, articles, changerQuantite, retirer } = usePanier()
  const boutique = useBoutique()

  if (lignes.length === 0) {
    return (
      <div className="pile-large">
        <h1>Votre panier</h1>
        <EtatVide titre="Votre panier est vide">
          <p className="texte-petit">
            <Link to="/catalogue">Parcourir le catalogue</Link>
          </p>
        </EtatVide>
      </div>
    )
  }

  return (
    <div className="pile-large">
      <h1>Votre panier</h1>

      <ul className="panier-boutique">
        {lignes.map((ligne) => (
          <li key={ligne.variante_id}>
            <Link to={`/p/${ligne.produit_slug}`} className="panier-boutique__photo">
              {ligne.image ? (
                <img src={ligne.image} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="vignette__absente" aria-hidden="true" />
              )}
            </Link>

            <div className="panier-boutique__corps">
              <Link to={`/p/${ligne.produit_slug}`} className="panier-boutique__nom">
                {ligne.produit_nom}
              </Link>
              <p className="texte-gris texte-petit">
                {ligne.libelle} · {fcfa(ligne.prix)}
              </p>
              <div className="rangee" style={{ marginTop: 8 }}>
                <span className="quantite">
                  <button
                    type="button"
                    onClick={() => changerQuantite(ligne.variante_id, ligne.quantite - 1)}
                    aria-label={`Retirer un ${ligne.produit_nom}`}
                  >
                    −
                  </button>
                  <span>{ligne.quantite}</span>
                  <button
                    type="button"
                    onClick={() => changerQuantite(ligne.variante_id, ligne.quantite + 1)}
                    aria-label={`Ajouter un ${ligne.produit_nom}`}
                  >
                    +
                  </button>
                </span>
                <button type="button" className="bouton-lien" onClick={() => retirer(ligne.variante_id)}>
                  Retirer
                </button>
              </div>
            </div>

            <p className="article__prix">{fcfa(ligne.prix * ligne.quantite)}</p>
          </li>
        ))}
      </ul>

      <div className="recapitulatif">
        <div className="recapitulatif__ligne">
          <span>{articles} article(s)</span>
          <strong>{fcfa(total)}</strong>
        </div>
        <div className="recapitulatif__ligne texte-gris">
          <span>Livraison à {boutique.zone_livraison}</span>
          <span>à convenir</span>
        </div>
        <Link className="bouton bouton--grand bouton--plein" to="/commande">
          Commander
        </Link>
        <p className="texte-gris texte-petit" style={{ marginTop: 10 }}>
          Vous payez à la livraison. Aucun compte à créer.
        </p>
      </div>
    </div>
  )
}
