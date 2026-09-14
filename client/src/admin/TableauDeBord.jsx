import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, fcfa, pluriel } from '../format.js'
import { classeStatut, libelleStatut } from '../statuts.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { AnnonceChargement, EtatVide, SqueletteBloc, SqueletteListe } from '../composants/Etats.jsx'

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
        <div className="bord">
          <div className="bord__principal" style={{ display: 'block' }}>
            <SqueletteBloc hauteur={72} />
          </div>
          <div className="bord__panneau"><SqueletteBloc hauteur={104} /></div>
          <div className="bord__panneau"><SqueletteBloc hauteur={104} /></div>
        </div>
        <div className="carte">
          <SqueletteListe nombre={3} avecVignette={false} />
        </div>
      </div>
    )
  }
  if (!resume) return null

  const { ventes_du_jour: jour, commandes_en_attente: attente, alertes, dernieres_commandes: dernieres } = resume

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Bonjour {utilisateur.nom.split(' ')[0]}</h1>
          <p>Ce qui se passe aujourd'hui dans la boutique.</p>
        </div>
        <div className="entete-page__actions">
          <Link className="bouton" to="/admin/vente">
            Nouvelle vente
          </Link>
        </div>
      </div>

      <div className="bord">
        {/* La mesure du jour porte l'écran ; le reste est du suivi. */}
        <section className="bord__principal">
          <div className="bord__mesure">
            <span className="bord__mesure-titre">Ventes du jour</span>
            <p className="chiffre">{estProprietaire ? fcfa(jour.total) : jour.nb}</p>
            <p className="texte-gris texte-petit">
              {estProprietaire
                ? `${pluriel(jour.nb, 'commande')} · panier moyen ${fcfa(jour.panier_moyen)}`
                : `${jour.nb > 1 ? 'commandes enregistrées' : 'commande enregistrée'} aujourd'hui`}
            </p>
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
            {estProprietaire && resume.valeur_stock && (
              <span className="bord__secondaire">
                <strong>{fcfa(resume.valeur_stock.prix_vente)}</strong>
                <span>stock en rayon · {fcfa(resume.valeur_stock.prix_achat)} d'achat</span>
              </span>
            )}
          </div>
        </section>

        <section className="bord__panneau">
          <div className="bord__panneau-entete">
            <h2>Commandes à traiter</h2>
            <span className="etiquette">{attente.total}</span>
          </div>
          <div className="rangee" style={{ gap: 6 }}>
            {['nouvelle', 'confirmee', 'en_livraison', 'livree'].map((statut) =>
              attente[statut] > 0 ? (
                <Link key={statut} to={`/admin/commandes?statut=${statut}`} className={classeStatut(statut)}>
                  {attente[statut]} {libelleStatut(statut).toLowerCase()}
                </Link>
              ) : null,
            )}
            {attente.total === 0 && (
              <span className="texte-gris texte-petit">Tout est traité, rien n'attend.</span>
            )}
          </div>
          {resume.non_vues > 0 && (
            <p>
              <Link to="/admin/commandes">
                {pluriel(
                  resume.non_vues,
                  'commande en ligne pas encore ouverte',
                  'commandes en ligne pas encore ouvertes',
                )}
              </Link>
            </p>
          )}
        </section>

        <section className="bord__panneau">
          <div className="bord__panneau-entete">
            <h2>Stock en alerte</h2>
            <span className={alertes.nb > 0 ? 'etiquette etiquette--alerte' : 'etiquette'}>
              {alertes.nb}
            </span>
          </div>
          {alertes.nb === 0 ? (
            <p className="texte-gris texte-petit">Aucune variante sous son seuil.</p>
          ) : (
            <ul className="liste-simple">
              {alertes.liste.map((alerte) => (
                <li key={alerte.variante_id}>
                  <span className="liste-simple__intitule">
                    <Link to={`/admin/produits/${alerte.produit_id}`}>
                      {alerte.produit_nom} · {alerte.libelle}
                    </Link>
                  </span>
                  <span className="etiquette etiquette--alerte">
                    {pluriel(alerte.quantite, 'restant')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to="/admin/stock">Ouvrir le stock</Link>
          </p>
        </section>

      </div>

      <div className="carte">
        <div className="carte__titre">
          <h2>Dernières commandes</h2>
          <Link className="bouton bouton--discret bouton--petit" to="/admin/commandes">
            Tout voir
          </Link>
        </div>
        {dernieres.length === 0 ? (
          <EtatVide titre="Aucune commande pour l'instant">
            <p className="texte-petit">La première vente au comptoir apparaîtra ici.</p>
          </EtatVide>
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
