import { lazy, Suspense, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { FournisseurBoutique } from './boutique.jsx'
import { FournisseurPanier } from './panier.jsx'
import { FournisseurToasts } from './composants/Toasts.jsx'
import { Chargement, EtatVide } from './composants/Etats.jsx'
import { HorsLigne } from './composants/HorsLigne.jsx'
import MiseEnPageBoutique from './boutique/MiseEnPageBoutique.jsx'
import Accueil from './boutique/Accueil.jsx'
import Categorie from './boutique/Categorie.jsx'
import Produit from './boutique/Produit.jsx'
import PagePanier from './boutique/PagePanier.jsx'
import Commande from './boutique/Commande.jsx'
import Confirmation from './boutique/Confirmation.jsx'
import PaiementRetour from './boutique/PaiementRetour.jsx'

/* Le back-office est chargé à la demande : un client venu acheter un
   diffuseur ne télécharge pas les écrans de gestion. */
const Admin = lazy(() => import('./admin/Admin.jsx'))

/** Changer de page ramène en haut, comme sur un site classique. */
function RemonterEnHaut() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <FournisseurToasts>
      <FournisseurBoutique>
        <FournisseurPanier>
          <RemonterEnHaut />
          <HorsLigne />
          <Routes>
            <Route element={<MiseEnPageBoutique />}>
              <Route index element={<Accueil />} />
              <Route path="/catalogue" element={<Categorie />} />
              <Route path="/c/:slug" element={<Categorie />} />
              <Route path="/p/:slug" element={<Produit />} />
              <Route path="/panier" element={<PagePanier />} />
              <Route path="/commande" element={<Commande />} />
              <Route path="/commande/confirmation" element={<Confirmation />} />
              <Route path="/commande/paiement" element={<PaiementRetour />} />
              <Route
                path="*"
                element={
                  <EtatVide titre="Page introuvable">
                    <p className="texte-petit">
                      <Link to="/">Revenir à la boutique</Link>
                    </p>
                  </EtatVide>
                }
              />
            </Route>

            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<Chargement texte="Ouverture du back-office…" />}>
                  <Admin />
                </Suspense>
              }
            />
          </Routes>
        </FournisseurPanier>
      </FournisseurBoutique>
    </FournisseurToasts>
  )
}
