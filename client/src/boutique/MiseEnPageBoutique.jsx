import { Link, NavLink, Outlet } from 'react-router-dom'
import { useBoutique } from '../boutique.jsx'
import { usePanier } from '../panier.jsx'
import { IconeVente, IconeWhatsApp } from '../composants/Icones.jsx'

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

        <Link to="/panier" className="boutique__panier" aria-label={`Panier — ${articles} article(s)`}>
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
      </footer>
    </div>
  )
}
