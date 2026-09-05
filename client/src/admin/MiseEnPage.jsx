import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { IconeCompte, IconeProduits, IconeStock, IconeVente } from '../composants/Icones.jsx'

const ONGLETS = [
  { vers: '/admin', libelle: 'Vente', Icone: IconeVente, exact: true },
  { vers: '/admin/produits', libelle: 'Produits', Icone: IconeProduits },
  { vers: '/admin/stock', libelle: 'Stock', Icone: IconeStock },
  { vers: '/admin/compte', libelle: 'Compte', Icone: IconeCompte },
]

export default function MiseEnPage() {
  const { utilisateur, deconnexion } = useAuth()

  return (
    <div className="admin">
      <header className="admin__entete">
        <div className="admin__marque">
          Darou <span>Minane</span>
        </div>
        <div className="admin__compte">
          <span className="texte-petit">
            {utilisateur.nom} · {utilisateur.role === 'proprietaire' ? 'Propriétaire' : 'Employé'}
          </span>
          <button type="button" className="bouton bouton--discret bouton--petit" onClick={deconnexion}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="admin__corps">
        <nav className="admin__nav" aria-label="Sections du back-office">
          {ONGLETS.map(({ vers, libelle, Icone, exact }) => (
            <NavLink key={vers} to={vers} end={exact}>
              <Icone />
              {libelle}
            </NavLink>
          ))}
        </nav>

        <main className="admin__contenu">
          <Outlet />
        </main>
      </div>

      <nav className="barre-onglets" aria-label="Sections du back-office">
        {ONGLETS.map(({ vers, libelle, Icone, exact }) => (
          <NavLink key={vers} to={vers} end={exact}>
            <Icone />
            {libelle}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
