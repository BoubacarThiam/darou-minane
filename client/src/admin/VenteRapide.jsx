import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ErreurApi } from '../api.js'
import { fcfa, pluriel } from '../format.js'
import { useToasts } from '../composants/Toasts.jsx'
import { Chargement, EtatVide } from '../composants/Etats.jsx'
import { Modale } from '../composants/Modale.jsx'
import { Champ } from '../composants/Champ.jsx'
import { IconeRecherche } from '../composants/Icones.jsx'

/**
 * Écran prioritaire du back-office : encaisser une vente au comptoir en
 * trois gestes — chercher, toucher l'article, encaisser. C'est cet écran
 * qui garde le stock juste.
 */
export default function VenteRapide() {
  const toasts = useToasts()
  const [recherche, setRecherche] = useState('')
  const [articles, setArticles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [panier, setPanier] = useState([])
  const [confirmation, setConfirmation] = useState(false)
  const [nomClient, setNomClient] = useState('')
  const [envoi, setEnvoi] = useState(false)
  /* Sur téléphone, le ticket déplié occupait 65 % de l'écran : à trois
     articles le vendeur ne voyait plus le catalogue pour en ajouter un
     quatrième. Il reste donc replié sur son total, et s'ouvre à la
     demande. Sur grand écran il occupe sa propre colonne, toujours
     visible : la question n'y est pas posée. */
  const [ticketOuvert, setTicketOuvert] = useState(false)
  const champRecherche = useRef(null)

  const charger = useCallback(
    async (terme) => {
      setChargement(true)
      try {
        const resultats = await api.get('/admin/variantes', { q: terme, limite: 30 })
        setArticles(resultats)
      } catch (probleme) {
        toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Recherche impossible.')
      } finally {
        setChargement(false)
      }
    },
    [toasts],
  )

  useEffect(() => {
    const minuteur = window.setTimeout(() => charger(recherche), recherche ? 250 : 0)
    return () => window.clearTimeout(minuteur)
  }, [recherche, charger])

  function ajouter(article) {
    if (article.quantite <= 0) {
      toasts.erreur(`${article.produit_nom} — ${article.libelle} est en rupture.`)
      return
    }
    setPanier((actuel) => {
      const existante = actuel.find((ligne) => ligne.variante_id === article.id)
      if (!existante) {
        return [
          ...actuel,
          {
            variante_id: article.id,
            produit_nom: article.produit_nom,
            libelle: article.libelle,
            prix: article.prix,
            quantite: 1,
            stock: article.quantite,
          },
        ]
      }
      if (existante.quantite >= existante.stock) {
        toasts.erreur(`Il ne reste que ${existante.stock} ${article.produit_nom} en stock.`)
        return actuel
      }
      return actuel.map((ligne) =>
        ligne.variante_id === article.id ? { ...ligne, quantite: ligne.quantite + 1 } : ligne,
      )
    })
  }

  function changerQuantite(varianteId, ecart) {
    setPanier((actuel) =>
      actuel
        .map((ligne) => {
          if (ligne.variante_id !== varianteId) return ligne
          const quantite = Math.min(ligne.stock, ligne.quantite + ecart)
          return { ...ligne, quantite }
        })
        .filter((ligne) => ligne.quantite > 0),
    )
  }

  const total = panier.reduce((somme, ligne) => somme + ligne.prix * ligne.quantite, 0)

  async function encaisser() {
    setEnvoi(true)
    try {
      const commande = await api.post('/admin/commandes', {
        lignes: panier.map(({ variante_id, quantite }) => ({ variante_id, quantite })),
        ...(nomClient.trim() ? { client_nom: nomClient.trim() } : {}),
      })
      toasts.succes(`Vente ${commande.reference} enregistrée · ${fcfa(commande.total)}`)
      setPanier([])
      setNomClient('')
      setConfirmation(false)
      setRecherche('')
      champRecherche.current?.focus()
      charger('')
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Vente non enregistrée.')
      if (probleme instanceof ErreurApi && probleme.statut === 409) {
        setConfirmation(false)
        charger(recherche) // le stock a bougé : on rafraîchit ce qui est affiché
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="vente">
      <div className="entete-page">
        <div>
          <h1>Vente rapide</h1>
          <p>Vente au comptoir — le stock est décrémenté à l'encaissement.</p>
        </div>
      </div>

      <div className="vente__plan">
        <div className="vente__catalogue">
      <div className="vente__recherche">
        <label className="sr-seulement" htmlFor="recherche-article">
          Rechercher un article
        </label>
        <div style={{ position: 'relative' }}>
          <IconeRecherche
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              color: 'var(--gris)',
            }}
          />
          <input
            id="recherche-article"
            ref={champRecherche}
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder="Nom du produit ou SKU"
            style={{ paddingLeft: 40 }}
            autoFocus
            autoComplete="off"
          />
        </div>
      </div>

      <div className="vente__resultats">
        {chargement ? (
          <Chargement />
        ) : articles.length === 0 ? (
          <EtatVide titre="Aucun article trouvé">
            <p className="texte-petit">Essayez un autre nom ou un SKU.</p>
          </EtatVide>
        ) : (
          <ul className="liste-articles">
            {articles.map((article) => (
              <li key={article.id}>
                <button type="button" className="article" onClick={() => ajouter(article)}>
                  {article.image ? (
                    <img className="article__visuel" src={article.image} alt="" loading="lazy" />
                  ) : (
                    <span className="article__visuel" aria-hidden="true" />
                  )}
                  <span className="article__corps">
                    <span className="article__nom">{article.produit_nom}</span>
                    <span className="article__detail">
                      <span>{article.libelle}</span>
                      {article.quantite > 0 ? (
                        <span className={article.sous_seuil ? 'etiquette etiquette--alerte' : 'etiquette'}>
                          {article.quantite} en stock
                        </span>
                      ) : (
                        <span className="etiquette etiquette--alerte">Rupture</span>
                      )}
                    </span>
                  </span>
                  <span className="article__prix">{fcfa(article.prix)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>

      {panier.length > 0 && (
        <div
          className={ticketOuvert ? 'panier panier--ouvert' : 'panier'}
          aria-label="Ticket de la vente"
        >
          {/* Sur téléphone : la barre porte le total et ouvre le détail.
              Sur grand écran, le détail est toujours là et ce bouton est
              masqué — rien à déplier quand tout tient à l'écran. */}
          <button
            type="button"
            className="panier__bascule"
            onClick={() => setTicketOuvert((ouvert) => !ouvert)}
            aria-expanded={ticketOuvert}
          >
            <span>{pluriel(panier.reduce((somme, l) => somme + l.quantite, 0), 'article')}</span>
            <strong>{fcfa(total)}</strong>
            <span className="panier__chevron" aria-hidden="true">
              {ticketOuvert ? '▾' : '▴'}
            </span>
          </button>

          <div className="panier__detail">
          <ul className="panier__lignes">
            {panier.map((ligne) => (
              <li key={ligne.variante_id} className="panier__ligne">
                <span className="panier__nom">
                  {ligne.produit_nom}
                  <span>
                    {ligne.libelle} · {fcfa(ligne.prix)}
                  </span>
                </span>
                <span className="quantite">
                  <button
                    type="button"
                    onClick={() => changerQuantite(ligne.variante_id, -1)}
                    aria-label={`Retirer un ${ligne.produit_nom}`}
                  >
                    −
                  </button>
                  <span>{ligne.quantite}</span>
                  <button
                    type="button"
                    onClick={() => changerQuantite(ligne.variante_id, 1)}
                    aria-label={`Ajouter un ${ligne.produit_nom}`}
                    disabled={ligne.quantite >= ligne.stock}
                  >
                    +
                  </button>
                </span>
                <span className="article__prix">{fcfa(ligne.prix * ligne.quantite)}</span>
              </li>
            ))}
          </ul>

          <div className="rangee">
            <button type="button" className="bouton bouton--discret" onClick={() => setPanier([])}>
              Vider
            </button>
            <button
              type="button"
              className="bouton bouton--grand bouton--encaisser"
              onClick={() => setConfirmation(true)}
            >
              Encaisser {fcfa(total)}
            </button>
          </div>
          </div>
        </div>
      )}
      </div>

      {confirmation && (
        <Modale
          titre="Confirmer la vente"
          onFermer={() => setConfirmation(false)}
          actions={
            <>
              <button type="button" className="bouton bouton--discret" onClick={() => setConfirmation(false)}>
                Annuler
              </button>
              <button type="button" className="bouton" onClick={encaisser} disabled={envoi}>
                {envoi ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </>
          }
        >
          <p className="panier__total">
            <span className="texte-gris">Total encaissé</span>
            <strong>{fcfa(total)}</strong>
          </p>
          <Champ
            libelle="Nom du client (facultatif)"
            value={nomClient}
            onChange={(evenement) => setNomClient(evenement.target.value)}
            placeholder="Client comptoir"
            aide="Utile seulement si le client doit repasser."
          />
        </Modale>
      )}
    </div>
  )
}
