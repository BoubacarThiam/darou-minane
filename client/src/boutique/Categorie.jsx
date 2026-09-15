import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { pluriel } from '../format.js'
import {
  AnnonceChargement,
  EtatVide,
  Pagination,
  SqueletteGrille,
  SquelettePuces,
} from '../composants/Etats.jsx'
import { CarteProduit } from './CarteProduit.jsx'

/** Page catégorie et catalogue complet (mêmes filtres, sans le slug). */
export default function Categorie() {
  const { slug } = useParams()
  const [parametres, setParametres] = useSearchParams()

  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [pagination, setPagination] = useState(null)
  const [chargement, setChargement] = useState(true)

  const tri = parametres.get('tri') ?? 'recent'
  const prixMin = parametres.get('prix_min') ?? ''
  const prixMax = parametres.get('prix_max') ?? ''
  const page = Number(parametres.get('page') ?? 1)

  const modifier = useCallback(
    (changements) => {
      const suivants = new URLSearchParams(parametres)
      for (const [cle, valeur] of Object.entries(changements)) {
        if (valeur === '' || valeur === null) suivants.delete(cle)
        else suivants.set(cle, String(valeur))
      }
      if (!('page' in changements)) suivants.delete('page')
      setParametres(suivants)
    },
    [parametres, setParametres],
  )

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    let annule = false
    setChargement(true)
    api
      .get('/produits', { categorie: slug, tri, prix_min: prixMin, prix_max: prixMax, page, par_page: 12 })
      .then((reponse) => {
        if (annule) return
        setProduits(reponse.donnees)
        setPagination(reponse.pagination)
      })
      .catch(() => {})
      .finally(() => { if (!annule) setChargement(false) })
    return () => { annule = true }
  }, [slug, tri, prixMin, prixMax, page])

  const categorie = categories.find((c) => c.slug === slug)

  /* Un rayon sans article est une impasse : l'accueil les masque déjà, la
     barre de filtres les proposait encore. On garde le rayon ouvert même
     vide, sinon la pastille active disparaîtrait sous le client. */
  const rayons = categories.filter((autre) => autre.nb_produits > 0 || autre.slug === slug)

  return (
    <div className="pile-large">
      <div className="fil-ariane">
        <Link to="/">Accueil</Link>
        <span aria-hidden="true">·</span>
        <span>{categorie ? categorie.nom : 'Tout le catalogue'}</span>
      </div>

      <div className="section__titre">
        <h1>{categorie ? categorie.nom : 'Tout le catalogue'}</h1>
        <p className="texte-gris">{pagination ? pluriel(pagination.total, 'article') : ''}</p>
      </div>

      <div className="rayons rayons--filtres">
        <Link className={!slug ? 'puce puce--active' : 'puce'} to="/catalogue">
          Tout
        </Link>
        {categories.length === 0 ? (
          <SquelettePuces nombre={3} />
        ) : (
          rayons.map((autre) => (
            <Link
              key={autre.id}
              className={autre.slug === slug ? 'puce puce--active' : 'puce'}
              to={`/c/${autre.slug}`}
            >
              {autre.nom}
            </Link>
          ))
        )}
      </div>

      <div className="filtres">
        <label className="champ" style={{ margin: 0 }}>
          <span className="champ__libelle">Trier</span>
          <select value={tri} onChange={(evenement) => modifier({ tri: evenement.target.value })}>
            <option value="recent">Nouveautés</option>
            <option value="prix_asc">Prix croissant</option>
            <option value="prix_desc">Prix décroissant</option>
            <option value="nom">Nom</option>
          </select>
        </label>
        <label className="champ" style={{ margin: 0 }}>
          <span className="champ__libelle">Prix minimum</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="500"
            value={prixMin}
            onChange={(evenement) => modifier({ prix_min: evenement.target.value })}
            placeholder="0"
          />
        </label>
        <label className="champ" style={{ margin: 0 }}>
          <span className="champ__libelle">Prix maximum</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="500"
            value={prixMax}
            onChange={(evenement) => modifier({ prix_max: evenement.target.value })}
            placeholder="50 000"
          />
        </label>
      </div>

      {chargement ? (
        <>
          <AnnonceChargement texte="Chargement des articles…" />
          <SqueletteGrille nombre={6} />
        </>
      ) : produits.length === 0 ? (
        <EtatVide titre="Aucun article dans cette fourchette">
          <p className="texte-petit">Élargissez le prix ou changez de rayon.</p>
        </EtatVide>
      ) : (
        <div className="grille-produits">
          {produits.map((produit, rang) => (
            <CarteProduit key={produit.id} produit={produit} prioritaire={rang < 4} />
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPage={(suivante) => modifier({ page: suivante })} />
    </div>
  )
}
