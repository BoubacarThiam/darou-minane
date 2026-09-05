import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FournisseurAuth, useAuth } from './auth.jsx'
import { FournisseurNotifications } from './notifications.jsx'
import { FournisseurToasts } from './composants/Toasts.jsx'
import { Chargement, EtatVide } from './composants/Etats.jsx'
import { Garde } from './composants/Garde.jsx'
import MiseEnPage from './admin/MiseEnPage.jsx'
import Connexion from './admin/Connexion.jsx'
import TableauDeBord from './admin/TableauDeBord.jsx'
import VenteRapide from './admin/VenteRapide.jsx'
import Commandes from './admin/Commandes.jsx'
import CommandeDetail from './admin/CommandeDetail.jsx'
import ListeProduits from './admin/ListeProduits.jsx'
import FicheProduit from './admin/FicheProduit.jsx'
import Stock from './admin/Stock.jsx'
import Comptes from './admin/Comptes.jsx'
import Compte from './admin/Compte.jsx'

function ExigerConnexion({ children }) {
  const { utilisateur, chargement } = useAuth()
  const emplacement = useLocation()

  if (chargement) return <Chargement texte="Ouverture de la session…" />
  if (!utilisateur) return <Navigate to="/admin/connexion" replace state={{ depuis: emplacement.pathname }} />
  return children
}

/** Écrans réservés au propriétaire ; l'API refuse de toute façon. */
function ExigerProprietaire({ children }) {
  const { estProprietaire } = useAuth()
  if (!estProprietaire) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <FournisseurToasts>
      <FournisseurAuth>
        <FournisseurNotifications>
          <Routes>
            {/* La boutique publique arrive à l'étape 5 ; pour l'instant la
                racine mène au back-office. */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/connexion" element={<Connexion />} />
            <Route
              path="/admin"
              element={
                <ExigerConnexion>
                  <Garde>
                    <MiseEnPage />
                  </Garde>
                </ExigerConnexion>
              }
            >
              <Route index element={<TableauDeBord />} />
              <Route path="vente" element={<VenteRapide />} />
              <Route path="commandes" element={<Commandes />} />
              <Route path="commandes/:id" element={<CommandeDetail />} />
              <Route path="produits" element={<ListeProduits />} />
              <Route path="produits/nouveau" element={<FicheProduit />} />
              <Route path="produits/:id" element={<FicheProduit />} />
              <Route path="stock" element={<Stock />} />
              <Route
                path="equipe"
                element={
                  <ExigerProprietaire>
                    <Comptes />
                  </ExigerProprietaire>
                }
              />
              <Route path="compte" element={<Compte />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="admin__contenu">
                  <EtatVide titre="Page introuvable">
                    <a href="/admin">Revenir au back-office</a>
                  </EtatVide>
                </div>
              }
            />
          </Routes>
        </FournisseurNotifications>
      </FournisseurAuth>
    </FournisseurToasts>
  )
}
