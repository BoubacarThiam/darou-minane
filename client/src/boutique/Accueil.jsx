import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { pluriel } from '../format.js'
import { useBoutique } from '../boutique.jsx'
import { AnnonceChargement, SqueletteGrille } from '../composants/Etats.jsx'
import { CarteProduit } from './CarteProduit.jsx'
import { GalerieCirculaire } from './GalerieCirculaire.jsx'

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
      api.get('/produits', { mis_en_avant: 1, par_page: 9 }),
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

  const accroche = (
    <section className="accroche">
      <h1>Parfums, diffuseurs, montres et lunettes</h1>
      <p>
        La boutique d'Abdou Karim à Tambacounda. Vous commandez ici, nous vous appelons
        pour convenir de la livraison, vous payez au livreur.
      </p>
      <div className="accroche__faits">
        <span className="accroche__fait">
          <strong>Paiement à la livraison</strong>
          <span>En main propre, rien d'avance.</span>
        </span>
        <span className="accroche__fait">
          <strong>Livraison à {boutique.zone_livraison}</strong>
          <span>Frais convenus au téléphone.</span>
        </span>
        <span className="accroche__fait">
          <strong>Sans compte</strong>
          <span>Votre nom, votre numéro, un repère.</span>
        </span>
      </div>
    </section>
  )

  if (chargement) {
    return (
      <div className="pile-large">
        {accroche}
        <AnnonceChargement texte="Chargement du catalogue…" />
        <SqueletteGrille nombre={8} />
      </div>
    )
  }

  return (
    <div className="pile-large">
      {accroche}

      <section>
        <div className="section__titre">
          <h2>Nos rayons</h2>
        </div>
        <div className="rayons">
          {categories.map((categorie) => (
            <Link key={categorie.id} className="rayon" to={`/c/${categorie.slug}`}>
              <span className="rayon__nom">{categorie.nom}</span>
              <span className="rayon__nombre">{pluriel(categorie.nb_produits, 'article')}</span>
            </Link>
          ))}
        </div>
      </section>

      {enAvant.length > 0 && (
        <section>
          <div className="section__titre">
            <h2>La sélection de la boutique</h2>
          </div>
          {/* La sélection se parcourt, le catalogue se balaie : une galerie
              en arc ici, la grille sobre plus bas. */}
          <GalerieCirculaire produits={enAvant} />
        </section>
      )}

      <section>
        <div className="section__titre">
          <h2>Derniers arrivages</h2>
          <Link to="/catalogue">Tout le catalogue</Link>
        </div>
        <div className="grille-produits">
          {/* Sans sélection au-dessus, ce sont ces cartes-ci qui ouvrent la page. */}
          {nouveautes.map((produit, rang) => (
            <CarteProduit
              key={produit.id}
              produit={produit}
              prioritaire={enAvant.length === 0 && rang < 4}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
