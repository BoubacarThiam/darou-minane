import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, fcfa, pluriel } from '../format.js'
import { classeStatut, libelleStatut } from '../statuts.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { AnnonceChargement, SqueletteBloc, SqueletteListe } from '../composants/Etats.jsx'
import {
  IconeBoutique,
  IconeCommandes,
  IconePlus,
  IconeProduits,
  IconeStock,
  IconeTendance,
  IconeVente,
} from '../composants/Icones.jsx'

/** « Mercredi 16 septembre » : majuscule au jour seulement, le mois reste en
    minuscule comme le veut le français (capitalize les mettait toutes deux). */
function aujourdhui() {
  const texte = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

export default function TableauDeBord() {
  const { utilisateur, estProprietaire } = useAuth()
  const toasts = useToasts()
  const [resume, setResume] = useState(null)
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      setResume(await api.get('/admin/tableau-de-bord'))
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [toasts])

  useEffect(() => { charger() }, [charger])

  if (chargement) {
    return (
      <div>
        <AnnonceChargement texte="Chargement du tableau de bord…" />
        <SqueletteBloc hauteur={150} />
        <div className="tuiles" style={{ marginTop: 16 }}>
          {[0, 1, 2, 3].map((i) => <SqueletteBloc key={i} hauteur={96} />)}
        </div>
        <div className="carte" style={{ marginTop: 16 }}>
          <SqueletteListe nombre={3} avecVignette={false} />
        </div>
      </div>
    )
  }
  if (!resume) return null

  const {
    ventes_du_jour: jour,
    commandes_en_attente: attente,
    alertes,
    dernieres_commandes: dernieres,
    catalogue,
    semaine,
  } = resume
  const premierPrenom = utilisateur.nom.split(' ')[0]
  const aucuneVente = jour.nb === 0

  return (
    <div className="bord-page">
      <div className="entete-page">
        <div>
          <p className="bord-page__date">{aujourdhui()}</p>
          <h1>Bonjour {premierPrenom}</h1>
        </div>
        <div className="entete-page__actions">
          <Link className="bouton" to="/admin/vente">
            <IconeVente style={{ width: 18, height: 18 }} />
            Nouvelle vente
          </Link>
        </div>
      </div>

      {/* --- La mesure du jour ---------------------------------------- */}
      <section className="bord__principal">
        <div className="bord__mesure">
          <span className="bord__mesure-titre">Ventes du jour</span>
          {aucuneVente ? (
            <>
              <p className="bord__accueil">Pas encore de vente aujourd'hui</p>
              <p className="bord__accueil-aide">
                Chaque encaissement au comptoir et chaque commande en ligne s'additionnent ici.
              </p>
            </>
          ) : (
            <>
              <p className="chiffre">{estProprietaire ? fcfa(jour.total) : jour.nb}</p>
              <p className="texte-gris texte-petit">
                {estProprietaire
                  ? `${pluriel(jour.nb, 'commande')} · panier moyen ${fcfa(jour.panier_moyen)}`
                  : `${jour.nb > 1 ? 'commandes enregistrées' : 'commande enregistrée'} aujourd'hui`}
              </p>
            </>
          )}
        </div>

        <div className="bord__secondaires">
          <span className="bord__secondaire">
            <strong>{jour.nb_comptoir}</strong>
            <span>au comptoir</span>
          </span>
          <span className="bord__secondaire">
            <strong>{jour.nb_en_ligne}</strong>
            <span>en ligne</span>
          </span>
        </div>
      </section>

      {/* --- Tuiles de chiffres --------------------------------------- */}
      <div className="tuiles">
        <Link className="tuile" to="/admin/produits">
          <span className="tuile__icone"><IconeProduits /></span>
          <span className="tuile__valeur">{catalogue.produits_en_vente}</span>
          <span className="tuile__libelle">
            {catalogue.produits_en_vente > 1 ? 'produits en vente' : 'produit en vente'}
          </span>
        </Link>

        {estProprietaire && resume.valeur_stock ? (
          <Link className="tuile" to="/admin/stock">
            <span className="tuile__icone"><IconeStock /></span>
            <span className="tuile__valeur">{fcfa(resume.valeur_stock.prix_vente)}</span>
            <span className="tuile__libelle">
              stock en rayon
              {resume.valeur_stock.prix_achat !== null &&
                ` · ${fcfa(resume.valeur_stock.prix_achat)} d'achat`}
            </span>
          </Link>
        ) : (
          <Link className="tuile" to="/admin/commandes">
            <span className="tuile__icone"><IconeCommandes /></span>
            <span className="tuile__valeur">{attente.total}</span>
            <span className="tuile__libelle">
              {attente.total > 1 ? 'commandes à traiter' : 'commande à traiter'}
            </span>
          </Link>
        )}

        <Link className="tuile" to="/admin/stock">
          <span className="tuile__icone"><IconeStock /></span>
          <span className="tuile__valeur">{catalogue.ruptures}</span>
          <span className="tuile__libelle">
            {catalogue.ruptures > 1 ? 'déclinaisons en rupture' : 'déclinaison en rupture'}
          </span>
        </Link>

        <Link className="tuile" to="/admin/commandes">
          <span className="tuile__icone"><IconeTendance /></span>
          <span className="tuile__valeur">
            {estProprietaire && semaine.total !== undefined ? fcfa(semaine.total) : semaine.nb}
          </span>
          <span className="tuile__libelle">
            {estProprietaire ? `sur 7 jours · ${pluriel(semaine.nb, 'commande')}` : 'commandes sur 7 jours'}
          </span>
        </Link>
      </div>

      {/* --- Raccourcis ----------------------------------------------- */}
      <section>
        <h2 className="bord-page__intertitre">Accès rapides</h2>
        <div className="raccourcis">
          <Link className="raccourci raccourci--principal" to="/admin/vente">
            <span className="raccourci__icone"><IconeVente /></span>
            <span>
              <strong>Encaisser une vente</strong>
              <span>Au comptoir, en trois gestes</span>
            </span>
          </Link>
          {estProprietaire && (
            <Link className="raccourci" to="/admin/produits/nouveau">
              <span className="raccourci__icone"><IconePlus /></span>
              <span>
                <strong>Ajouter un produit</strong>
                <span>Avec ses photos</span>
              </span>
            </Link>
          )}
          <Link className="raccourci" to="/admin/stock">
            <span className="raccourci__icone"><IconeStock /></span>
            <span>
              <strong>Gérer le stock</strong>
              <span>Arrivage, perte, inventaire</span>
            </span>
          </Link>
          <a className="raccourci" href="/" target="_blank" rel="noreferrer">
            <span className="raccourci__icone"><IconeBoutique /></span>
            <span>
              <strong>Voir la boutique</strong>
              <span>Telle que vos clients la voient</span>
            </span>
          </a>
        </div>
      </section>

      {/* --- Travail en attente --------------------------------------- */}
      <div className="bord">
        <section className="bord__panneau">
          <div className="bord__panneau-entete">
            <span className="bord__icone" aria-hidden="true"><IconeCommandes /></span>
            <h2>Commandes à traiter</h2>
            <span className="etiquette">{attente.total}</span>
          </div>
          {attente.total === 0 ? (
            <p className="texte-gris texte-petit">Tout est traité, rien n'attend.</p>
          ) : (
            <div className="rangee" style={{ gap: 6 }}>
              {['nouvelle', 'confirmee', 'en_livraison', 'livree'].map((statut) =>
                attente[statut] > 0 ? (
                  <Link key={statut} to={`/admin/commandes?statut=${statut}`} className={classeStatut(statut)}>
                    {attente[statut]} {libelleStatut(statut).toLowerCase()}
                  </Link>
                ) : null,
              )}
            </div>
          )}
          {resume.non_vues > 0 && (
            <p>
              <Link to="/admin/commandes">
                {pluriel(resume.non_vues, 'commande en ligne pas encore ouverte', 'commandes en ligne pas encore ouvertes')}
              </Link>
            </p>
          )}
        </section>

        <section className="bord__panneau">
          <div className="bord__panneau-entete">
            <span className="bord__icone bord__icone--stock" aria-hidden="true"><IconeStock /></span>
            <h2>Stock en alerte</h2>
            <span className={alertes.nb > 0 ? 'etiquette etiquette--alerte' : 'etiquette'}>{alertes.nb}</span>
          </div>
          {alertes.nb === 0 ? (
            <p className="texte-gris texte-petit">Aucune déclinaison sous son seuil.</p>
          ) : (
            <ul className="liste-simple">
              {alertes.liste.map((alerte) => (
                <li key={alerte.variante_id}>
                  <span className="liste-simple__intitule">
                    <Link to={`/admin/produits/${alerte.produit_id}`}>
                      {alerte.produit_nom} · {alerte.libelle}
                    </Link>
                  </span>
                  <span className="etiquette etiquette--alerte">{pluriel(alerte.quantite, 'restant')}</span>
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to="/admin/stock">Ouvrir le stock</Link>
          </p>
        </section>
      </div>

      {/* --- Dernières commandes -------------------------------------- */}
      <div className="carte">
        <div className="carte__titre">
          <h2>Dernières commandes</h2>
          {dernieres.length > 0 && (
            <Link className="bouton bouton--discret bouton--petit" to="/admin/commandes">
              Tout voir
            </Link>
          )}
        </div>
        {dernieres.length === 0 ? (
          <div className="vide-accueil">
            <span className="vide-accueil__icone" aria-hidden="true"><IconeCommandes /></span>
            <p className="vide-accueil__titre">Votre première commande s'affichera ici</p>
            <p className="vide-accueil__texte">
              Encaissez une vente au comptoir, ou attendez qu'un client commande depuis la boutique.
            </p>
            <Link className="bouton" to="/admin/vente">
              <IconeVente style={{ width: 18, height: 18 }} />
              Encaisser une vente
            </Link>
          </div>
        ) : (
          <ul className="liste-articles">
            {dernieres.map((commande) => (
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
                      <span>{dateCourte(commande.created_at)}</span>
                    </span>
                  </span>
                  <span className="article__prix">{fcfa(commande.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
