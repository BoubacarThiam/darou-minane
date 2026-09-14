import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { fourchettePrix, pluriel } from '../format.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { AnnonceChargement, EtatVide, Pagination, SqueletteListe } from '../composants/Etats.jsx'

export default function ListeProduits() {
  const { estProprietaire } = useAuth()
  const toasts = useToasts()

  const [recherche, setRecherche] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [etat, setEtat] = useState('')          // '', '1' (en vente), '0' (retirés)
  const [sousSeuil, setSousSeuil] = useState(false)
  const [page, setPage] = useState(1)

  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [pagination, setPagination] = useState(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => setCategories([]))
  }, [])

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const reponse = await api.get('/admin/produits', {
        q: recherche,
        categorie_id: categorieId,
        actif: etat,
        sous_seuil: sousSeuil ? 1 : '',
        page,
        par_page: 20,
      })
      setProduits(reponse.donnees)
      setPagination(reponse.pagination)
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [recherche, categorieId, etat, sousSeuil, page, toasts])

  useEffect(() => {
    const minuteur = window.setTimeout(charger, recherche ? 250 : 0)
    return () => window.clearTimeout(minuteur)
  }, [charger, recherche])

  // Tout changement de filtre ramène à la première page.
  useEffect(() => { setPage(1) }, [recherche, categorieId, etat, sousSeuil])

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Produits</h1>
          <p>{pagination ? pluriel(pagination.total, 'produit') : ' '}</p>
        </div>
        {estProprietaire && (
          <div className="entete-page__actions">
            <Link className="bouton" to="/admin/produits/nouveau">
              Nouveau produit
            </Link>
          </div>
        )}
      </div>

      <div className="filtres">
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          placeholder="Nom du produit ou SKU"
          aria-label="Rechercher un produit"
        />
        <select
          value={categorieId}
          onChange={(evenement) => setCategorieId(evenement.target.value)}
          aria-label="Filtrer par catégorie"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
        <select value={etat} onChange={(evenement) => setEtat(evenement.target.value)} aria-label="Filtrer par état">
          <option value="">En vente et retirés</option>
          <option value="1">En vente</option>
          <option value="0">Retirés de la boutique</option>
        </select>
        <label className="rangee" style={{ flex: '0 0 auto', gap: 8 }}>
          <input
            type="checkbox"
            checked={sousSeuil}
            onChange={(evenement) => setSousSeuil(evenement.target.checked)}
            style={{ width: 20, minHeight: 20 }}
          />
          <span>Stock en alerte</span>
        </label>
      </div>

      {chargement ? (
        <>
          <AnnonceChargement texte="Chargement des produits…" />
          <SqueletteListe nombre={6} />
        </>
      ) : produits.length === 0 ? (
        <EtatVide titre="Aucun produit ne correspond">
          <p className="texte-petit">Modifiez les filtres ou ajoutez un produit.</p>
        </EtatVide>
      ) : (
        <ul className="liste-articles">
          {produits.map((produit) => (
            <li key={produit.id}>
              <Link className="article" to={`/admin/produits/${produit.id}`}>
                {produit.image ? (
                  <img className="article__visuel" src={produit.image} alt="" loading="lazy" />
                ) : (
                  <span className="article__visuel" aria-hidden="true" />
                )}
                <span className="article__corps">
                  <span className="article__nom">{produit.nom}</span>
                  <span className="article__detail">
                    <span>{produit.categorie.nom}</span>
                    <span>
                      {produit.nb_variantes} variante{produit.nb_variantes > 1 ? 's' : ''}
                    </span>
                    <span>{produit.stock_total} en stock</span>
                    {produit.alertes > 0 && (
                      <span className="etiquette etiquette--alerte">
                        {produit.alertes} en alerte
                      </span>
                    )}
                    {!produit.actif && <span className="etiquette">Retiré</span>}
                    {produit.mis_en_avant && <span className="etiquette etiquette--rose">Mis en avant</span>}
                  </span>
                </span>
                <span className="article__prix">{fourchettePrix(produit.prix_min, produit.prix_max)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination pagination={pagination} onPage={setPage} />
    </div>
  )
}
