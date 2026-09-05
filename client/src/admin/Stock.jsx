import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, delta, fcfa, libelleTypeMouvement } from '../format.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Chargement, EtatVide, Message, Pagination } from '../composants/Etats.jsx'
import { Modale } from '../composants/Modale.jsx'

const TYPES = [
  { valeur: 'entree', titre: 'Entrée de marchandise', proprietaireSeul: false },
  { valeur: 'perte', titre: 'Perte ou casse', proprietaireSeul: true },
  { valeur: 'ajustement', titre: 'Inventaire', proprietaireSeul: true },
]

export default function Stock() {
  const { estProprietaire } = useAuth()
  const toasts = useToasts()

  const [alertes, setAlertes] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filtreType, setFiltreType] = useState('')
  const [page, setPage] = useState(1)
  const [chargement, setChargement] = useState(true)
  const [mouvementOuvert, setMouvementOuvert] = useState(null) // { type, variante? }

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [listeAlertes, historique] = await Promise.all([
        api.get('/admin/stock/alertes'),
        api.get('/admin/stock/mouvements', { type: filtreType, page, par_page: 25 }),
      ])
      setAlertes(listeAlertes)
      setMouvements(historique.donnees)
      setPagination(historique.pagination)
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [filtreType, page, toasts])

  useEffect(() => { charger() }, [charger])

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Stock</h1>
          <p>Chaque mouvement explique une variation de quantité.</p>
        </div>
        <div className="entete-page__actions">
          {TYPES.filter((type) => estProprietaire || !type.proprietaireSeul).map((type) => (
            <button
              key={type.valeur}
              type="button"
              className={type.valeur === 'entree' ? 'bouton' : 'bouton bouton--discret'}
              onClick={() => setMouvementOuvert({ type: type.valeur })}
            >
              {type.titre}
            </button>
          ))}
        </div>
      </div>

      <div className="carte">
        <div className="carte__titre">
          <h2>Alertes de stock</h2>
          <span className="etiquette etiquette--alerte">{alertes.length}</span>
        </div>
        {alertes.length === 0 ? (
          <p className="texte-gris texte-petit">Aucune variante sous son seuil d'alerte.</p>
        ) : (
          <ul className="liste-articles">
            {alertes.map((alerte) => (
              <li key={alerte.variante_id}>
                <div className="article article--fixe">
                  <span className="article__corps">
                    <span className="article__nom">
                      <Link to={`/admin/produits/${alerte.produit_id}`}>{alerte.produit_nom}</Link>
                    </span>
                    <span className="article__detail">
                      <span>{alerte.libelle}</span>
                      <span className="texte-petit texte-gris">{alerte.sku}</span>
                      <span className="etiquette etiquette--alerte">
                        {alerte.quantite} en stock · seuil {alerte.seuil_alerte}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="bouton bouton--discret bouton--petit"
                    onClick={() =>
                      setMouvementOuvert({
                        type: 'entree',
                        variante: {
                          id: alerte.variante_id,
                          libelle: alerte.libelle,
                          produit_nom: alerte.produit_nom,
                          quantite: alerte.quantite,
                        },
                      })
                    }
                  >
                    Réapprovisionner
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="carte">
        <div className="carte__titre">
          <h2>Historique des mouvements</h2>
        </div>

        <div className="filtres">
          <select
            value={filtreType}
            onChange={(evenement) => {
              setFiltreType(evenement.target.value)
              setPage(1)
            }}
            aria-label="Filtrer par type de mouvement"
          >
            <option value="">Tous les mouvements</option>
            <option value="entree">Entrées</option>
            <option value="vente">Ventes</option>
            <option value="retour">Retours</option>
            <option value="perte">Pertes</option>
            <option value="ajustement">Inventaires</option>
          </select>
        </div>

        {chargement ? (
          <Chargement />
        ) : mouvements.length === 0 ? (
          <EtatVide titre="Aucun mouvement">
            <p className="texte-petit">L'historique se remplit dès la première entrée ou vente.</p>
          </EtatVide>
        ) : (
          <div className="tableau--defilant">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Article</th>
                  <th>Écart</th>
                  <th>Stock après</th>
                  <th>Motif</th>
                  <th>Par</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((mouvement) => (
                  <tr key={mouvement.id}>
                    <td className="texte-petit">{dateCourte(mouvement.created_at)}</td>
                    <td>
                      <span
                        className={
                          mouvement.quantite > 0 ? 'etiquette etiquette--succes' : 'etiquette etiquette--alerte'
                        }
                      >
                        {libelleTypeMouvement(mouvement.type)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/admin/produits/${mouvement.variante.produit_id}`}>
                        {mouvement.variante.produit_nom}
                      </Link>
                      <span className="texte-petit texte-gris"> · {mouvement.variante.libelle}</span>
                    </td>
                    <td>{delta(mouvement.quantite)}</td>
                    <td>{mouvement.quantite_apres}</td>
                    <td className="texte-petit">
                      {mouvement.motif ?? '—'}
                      {mouvement.commande_reference ? ` (${mouvement.commande_reference})` : ''}
                    </td>
                    <td className="texte-petit">{mouvement.utilisateur ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPage={setPage} />
      </div>

      {mouvementOuvert && (
        <ModaleMouvement
          type={mouvementOuvert.type}
          varianteInitiale={mouvementOuvert.variante}
          onFermer={() => setMouvementOuvert(null)}
          onEnregistre={() => {
            setMouvementOuvert(null)
            charger()
          }}
        />
      )}
    </div>
  )
}

/* --- Saisie d'un mouvement ------------------------------------------- */
function ModaleMouvement({ type, varianteInitiale, onFermer, onEnregistre }) {
  const toasts = useToasts()
  const definition = TYPES.find((t) => t.valeur === type)

  const [variante, setVariante] = useState(varianteInitiale ?? null)
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState([])
  const [quantite, setQuantite] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState(null)
  const [champs, setChamps] = useState({})
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (variante) return
    const minuteur = window.setTimeout(() => {
      api
        .get('/admin/variantes', { q: recherche, limite: 12 })
        .then(setResultats)
        .catch(() => setResultats([]))
    }, recherche ? 250 : 0)
    return () => window.clearTimeout(minuteur)
  }, [recherche, variante])

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      const corps = {
        variante_id: variante.id,
        type,
        motif: motif || undefined,
        ...(type === 'ajustement'
          ? { quantite_reelle: Number(quantite) }
          : { quantite: Number(quantite) }),
      }
      const resultat = await api.post('/admin/stock/mouvements', corps)
      toasts.succes(`${resultat.message} Stock : ${resultat.quantite}.`)
      onEnregistre()
    } catch (probleme) {
      if (probleme instanceof ErreurApi) {
        setErreur(probleme.message)
        setChamps(probleme.champs)
      } else {
        setErreur('Enregistrement impossible.')
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale titre={definition.titre} onFermer={onFermer}>
      <Message ton="erreur">{erreur}</Message>

      {!variante ? (
        <>
          <Champ
            libelle="Article concerné"
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Nom du produit ou SKU"
            autoFocus
          />
          <ul className="liste-articles">
            {resultats.map((article) => (
              <li key={article.id}>
                <button
                  type="button"
                  className="article"
                  onClick={() =>
                    setVariante({
                      id: article.id,
                      libelle: article.libelle,
                      produit_nom: article.produit_nom,
                      quantite: article.quantite,
                    })
                  }
                >
                  <span className="article__corps">
                    <span className="article__nom">{article.produit_nom}</span>
                    <span className="article__detail">
                      <span>{article.libelle}</span>
                      <span className="etiquette">{article.quantite} en stock</span>
                    </span>
                  </span>
                  <span className="article__prix">{fcfa(article.prix)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form onSubmit={enregistrer}>
          <p className="message message--info">
            {variante.produit_nom} — {variante.libelle} · {variante.quantite} en stock
            {!varianteInitiale && (
              <>
                {' '}
                <button type="button" className="bouton-lien" onClick={() => setVariante(null)}>
                  changer d'article
                </button>
              </>
            )}
          </p>

          <Champ
            libelle={type === 'ajustement' ? 'Quantité réellement comptée' : 'Quantité'}
            type="number"
            inputMode="numeric"
            min={type === 'ajustement' ? '0' : '1'}
            value={quantite}
            erreur={champs.quantite ?? champs.quantite_reelle}
            onChange={(evenement) => setQuantite(evenement.target.value)}
            aide={
              type === 'ajustement'
                ? "L'écart avec le stock théorique est enregistré automatiquement."
                : type === 'perte'
                  ? 'Nombre de pièces perdues ou cassées.'
                  : 'Nombre de pièces reçues.'
            }
            required
            autoFocus
          />

          <Champ
            libelle="Motif"
            value={motif}
            erreur={champs.motif}
            onChange={(evenement) => setMotif(evenement.target.value)}
            placeholder={
              type === 'entree' ? 'Arrivage Dakar du 05/09' : type === 'perte' ? 'Casse au transport' : 'Inventaire du soir'
            }
          />

          <div className="modale__actions">
            <button type="button" className="bouton bouton--discret" onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className="bouton" disabled={envoi || quantite === ''}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </Modale>
  )
}
