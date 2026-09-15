import { Link, NavLink, Outlet } from 'react-router-dom'
import { pluriel } from '../format.js'
import { useBoutique } from '../boutique.jsx'
import { usePanier } from '../panier.jsx'
import { IconeCompte, IconeVente, IconeWhatsApp } from '../composants/Icones.jsx'

export default function MiseEnPageBoutique() {
  const boutique = useBoutique()
  const { articles } = usePanier()

  return (
    <div className="boutique">
      <header className="boutique__entete">
        <Link to="/" className="boutique__marque">
          Darou <span>Minane</span>
        </Link>

        <nav className="boutique__liens" aria-label="Rayons">
          <NavLink to="/catalogue">Tout le catalogue</NavLink>
        </nav>

        <Link
          to="/panier"
          className="boutique__panier"
          aria-label={`Panier — ${pluriel(articles, 'article')}`}
        >
          <span className="onglet__icone">
            <IconeVente style={{ width: 22, height: 22 }} />
            {articles > 0 && <span className="badge">{articles > 9 ? '9+' : articles}</span>}
          </span>
          <span className="masque-mobile">Panier</span>
        </Link>
      </header>

      <main className="boutique__contenu">
        <Outlet />
      </main>

      <footer className="boutique__pied">
        <div>
          <p className="boutique__pied-marque">
            Darou Minane <span className="texte-gris">— {boutique.slogan}</span>
          </p>
          <p className="texte-gris texte-petit">
            Livraison à {boutique.zone_livraison} · frais à convenir · paiement à la livraison.
          </p>
        </div>
        <div className="boutique__pied-actions">
          {boutique.whatsapp && (
            <a
              className="bouton bouton--discret"
              href={`https://wa.me/${boutique.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <IconeWhatsApp style={{ width: 20, height: 20 }} />
              Nous écrire sur WhatsApp
            </a>
          )}
          {/* Raccourci vers la gestion. Il vit au pied de page : le
              commerçant sait où le trouver, le client ne tombe pas
              dessus en cherchant un produit.
              Il vise la connexion, pas /admin : on passe toujours par la
              saisie du numéro et du mot de passe. */}
          <Link className="boutique__lien-gestion" to="/admin/connexion">
            <IconeCompte style={{ width: 18, height: 18 }} />
            Espace gestion
          </Link>
        </div>
      </footer>
    </div>
  )
}
