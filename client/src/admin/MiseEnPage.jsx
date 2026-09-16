import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { pluriel } from '../format.js'
import { useNotifications } from '../notifications.jsx'
import {
  IconeBord,
  IconeCommandes,
  IconeCompte,
  IconeSortie,
  IconeProduits,
  IconeStock,
  IconeVente,
} from '../composants/Icones.jsx'

/* Onglets du bas sur téléphone : les cinq écrans utilisés debout dans la
   boutique. « Mon compte » et « Équipe » vivent dans l'en-tête et dans la
   colonne de gauche — on ne les ouvre pas dix fois par jour. */
const ONGLETS = [
  { vers: '/admin', libelle: 'Bord', Icone: IconeBord, exact: true },
  { vers: '/admin/vente', libelle: 'Vente', Icone: IconeVente },
  { vers: '/admin/commandes', libelle: 'Commandes', Icone: IconeCommandes, badge: true },
  { vers: '/admin/produits', libelle: 'Produits', Icone: IconeProduits },
  { vers: '/admin/stock', libelle: 'Stock', Icone: IconeStock },
]

export default function MiseEnPage() {
  const { utilisateur, deconnexion, estProprietaire } = useAuth()
  const { nonVues } = useNotifications()

  const liens = [
    ...ONGLETS,
    ...(estProprietaire ? [{ vers: '/admin/equipe', libelle: 'Équipe', Icone: IconeCompte }] : []),
  ]

  const contenuLien = ({ libelle, Icone, badge }) => (
    <>
      <span className="onglet__icone">
        <Icone />
        {badge && nonVues > 0 && (
          <span
            className="badge"
            aria-label={pluriel(nonVues, 'commande non ouverte', 'commandes non ouvertes')}
          >
            {nonVues > 9 ? '9+' : nonVues}
          </span>
        )}
      </span>
      {libelle}
    </>
  )

  return (
    <div className="admin">
      <header className="admin__entete">
        <div className="admin__marque">
          Darou <span>Minane</span>
        </div>
        <div className="admin__compte">
          <NavLink to="/admin/compte" className="bouton bouton--discret bouton--petit">
            <IconeCompte style={{ width: 18, height: 18 }} />
            <span className="texte-petit masque-mobile">{utilisateur.nom}</span>
          </NavLink>
          <button
            type="button"
            className="bouton bouton--discret bouton--petit"
            onClick={deconnexion}
            aria-label="Déconnexion"
          >
            <IconeSortie style={{ width: 18, height: 18 }} />
            <span className="admin__deconnexion-texte">Déconnexion</span>
          </button>
        </div>
      </header>

      <div className="admin__corps">
        <nav className="admin__nav" aria-label="Sections du back-office">
          {liens.map((lien) => (
            <NavLink key={lien.vers} to={lien.vers} end={lien.exact}>
              {contenuLien(lien)}
            </NavLink>
          ))}
        </nav>

        <main className="admin__contenu">
          <Outlet />
        </main>
      </div>

      <nav className="barre-onglets" aria-label="Sections du back-office">
        {ONGLETS.map((onglet) => (
          <NavLink key={onglet.vers} to={onglet.vers} end={onglet.exact}>
            {contenuLien(onglet)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
