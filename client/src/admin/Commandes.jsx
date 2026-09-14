import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, fcfa, pluriel } from '../format.js'
import { CANAUX, classeStatut, libelleStatut, STATUTS } from '../statuts.js'
import { useToasts } from '../composants/Toasts.jsx'
import { useNotifications } from '../notifications.jsx'
import { AnnonceChargement, EtatVide, Pagination, SqueletteListe } from '../composants/Etats.jsx'

export default function Commandes() {
  const toasts = useToasts()
  const { nonVues } = useNotifications()

  const [statut, setStatut] = useState('')
  const [canal, setCanal] = useState('')
  const [recherche, setRecherche] = useState('')
  const [seulementNonVues, setSeulementNonVues] = useState(false)
  const [page, setPage] = useState(1)

  const [commandes, setCommandes] = useState([])
  const [pagination, setPagination] = useState(null)
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const reponse = await api.get('/admin/commandes', {
        statut,
        canal,
        q: recherche,
        non_vues: seulementNonVues ? 1 : '',
        page,
        par_page: 20,
      })
      setCommandes(reponse.donnees)
      setPagination(reponse.pagination)
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [statut, canal, recherche, seulementNonVues, page, toasts])

  useEffect(() => {
    const minuteur = window.setTimeout(charger, recherche ? 250 : 0)
    return () => window.clearTimeout(minuteur)
  }, [charger, recherche])

  useEffect(() => { setPage(1) }, [statut, canal, recherche, seulementNonVues])

  // Une commande arrivée pendant qu'on regarde la liste doit s'y afficher.
  useEffect(() => { charger() }, [nonVues]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Commandes</h1>
          <p>
            {pagination ? pluriel(pagination.total, 'commande') : ' '}
            {nonVues > 0 &&
              ` · ${pluriel(nonVues, 'nouvelle non ouverte', 'nouvelles non ouvertes')}`}
          </p>
        </div>
      </div>

      <div className="filtres">
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          placeholder="Référence, nom ou téléphone"
          aria-label="Rechercher une commande"
        />
        <select value={statut} onChange={(evenement) => setStatut(evenement.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([valeur, { libelle }]) => (
            <option key={valeur} value={valeur}>{libelle}</option>
          ))}
        </select>
        <select value={canal} onChange={(evenement) => setCanal(evenement.target.value)} aria-label="Filtrer par canal">
          <option value="">En ligne et comptoir</option>
          {Object.entries(CANAUX).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>{libelle}</option>
          ))}
        </select>
        <label className="rangee" style={{ flex: '0 0 auto', gap: 8 }}>
          <input
            type="checkbox"
            checked={seulementNonVues}
            onChange={(evenement) => setSeulementNonVues(evenement.target.checked)}
            style={{ width: 20, minHeight: 20 }}
          />
          <span>Non ouvertes</span>
        </label>
      </div>

      {chargement ? (
        <>
          <AnnonceChargement texte="Chargement des commandes…" />
          <SqueletteListe nombre={6} avecVignette={false} />
        </>
      ) : commandes.length === 0 ? (
        <EtatVide titre="Aucune commande ne correspond">
          <p className="texte-petit">Modifiez les filtres pour élargir la recherche.</p>
        </EtatVide>
      ) : (
        <ul className="liste-articles">
          {commandes.map((commande) => (
            <li key={commande.id}>
              <Link className="article" to={`/admin/commandes/${commande.id}`}>
                <span className="article__corps">
                  <span className="article__nom">
                    {!commande.vue && commande.canal === 'en_ligne' && (
                      <span className="pastille" aria-label="Commande non ouverte" />
                    )}
                    {commande.reference}
                    <span className="texte-gris"> · {commande.client_nom}</span>
                  </span>
                  <span className="article__detail">
                    <span className={classeStatut(commande.statut)}>{libelleStatut(commande.statut)}</span>
                    <span>{CANAUX[commande.canal]}</span>
                    <span>{pluriel(commande.nb_articles, 'article')}</span>
                    <span>{dateCourte(commande.created_at)}</span>
                  </span>
                </span>
                <span className="article__prix">{fcfa(commande.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination pagination={pagination} onPage={setPage} />
    </div>
  )
}
