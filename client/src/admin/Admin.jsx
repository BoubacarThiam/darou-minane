import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FournisseurAuth, useAuth } from '../auth.jsx'
import { FournisseurNotifications } from '../notifications.jsx'
import { Chargement, EtatVide } from '../composants/Etats.jsx'
import { Garde } from '../composants/Garde.jsx'
import MiseEnPage from './MiseEnPage.jsx'
import Connexion from './Connexion.jsx'
import TableauDeBord from './TableauDeBord.jsx'
import VenteRapide from './VenteRapide.jsx'
import Commandes from './Commandes.jsx'
import CommandeDetail from './CommandeDetail.jsx'
import ListeProduits from './ListeProduits.jsx'
import FicheProduit from './FicheProduit.jsx'
import Stock from './Stock.jsx'
import Comptes from './Comptes.jsx'
import Compte from './Compte.jsx'

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

/**
 * Tout le back-office, chargé à la demande : un client de la boutique ne
 * télécharge jamais ce code (voir le découpage dans App.jsx).
 */
export default function Admin() {
  return (
    <FournisseurAuth>
      <FournisseurNotifications>
        <Routes>
          <Route path="connexion" element={<Connexion />} />
          <Route
            path="/"
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
            <Route
              path="*"
              element={
                <EtatVide titre="Page introuvable">
                  <Navigate to="/admin" replace />
                </EtatVide>
              }
            />
          </Route>
        </Routes>
      </FournisseurNotifications>
    </FournisseurAuth>
  )
}
