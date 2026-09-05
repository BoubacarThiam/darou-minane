import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useBoutique } from '../boutique.jsx'
import { Chargement } from '../composants/Etats.jsx'
import { CarteProduit } from './CarteProduit.jsx'

export default function Accueil() {
  const boutique = useBoutique()
  const [categories, setCategories] = useState([])
  const [enAvant, setEnAvant] = useState([])
  const [nouveautes, setNouveautes] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    let annule = false
    Promise.all([
      api.get('/categories'),
      api.get('/produits', { mis_en_avant: 1, par_page: 6 }),
      api.get('/produits', { tri: 'recent', par_page: 8 }),
    ])
      .then(([listeCategories, avant, recents]) => {
        if (annule) return
        setCategories(listeCategories.filter((categorie) => categorie.nb_produits > 0))
        setEnAvant(avant.donnees)
        setNouveautes(recents.donnees)
      })
      .catch(() => {})
      .finally(() => { if (!annule) setChargement(false) })
    return () => { annule = true }
  }, [])

  if (chargement) return <Chargement />

  return (
    <div className="pile-large">
      <section className="accroche">
        <h1>Parfums, diffuseurs, montres et lunettes</h1>
        <p>
          Commandez depuis Tambacounda, nous vous livrons et vous payez à la livraison.
          Les frais de livraison se conviennent au téléphone.
        </p>
      </section>

      <section>
        <div className="section__titre">
          <h2>Nos rayons</h2>
        </div>
        <div className="rayons">
          {categories.map((categorie) => (
            <Link key={categorie.id} className="rayon" to={`/c/${categorie.slug}`}>
              <span className="rayon__nom">{categorie.nom}</span>
              <span className="rayon__nombre">{categorie.nb_produits} article(s)</span>
            </Link>
          ))}
        </div>
      </section>

      {enAvant.length > 0 && (
        <section>
          <div className="section__titre">
            <h2>La sélection de la boutique</h2>
          </div>
          <div className="grille-produits">
            {enAvant.map((produit) => (
              <CarteProduit key={produit.id} produit={produit} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section__titre">
          <h2>Derniers arrivages</h2>
          <Link to="/catalogue">Tout le catalogue</Link>
        </div>
        <div className="grille-produits">
          {nouveautes.map((produit) => (
            <CarteProduit key={produit.id} produit={produit} />
          ))}
        </div>
      </section>

      <section className="rassurance">
        <div>
          <h3>Paiement à la livraison</h3>
          <p className="texte-gris texte-petit">Vous payez le livreur, en main propre.</p>
        </div>
        <div>
          <h3>Livraison à {boutique.zone_livraison}</h3>
          <p className="texte-gris texte-petit">Les frais se conviennent au téléphone.</p>
        </div>
        <div>
          <h3>Commande sans compte</h3>
          <p className="texte-gris texte-petit">Votre nom, votre numéro, un repère : c'est tout.</p>
        </div>
      </section>
    </div>
  )
}
