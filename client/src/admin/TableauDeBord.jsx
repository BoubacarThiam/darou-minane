import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, fcfa } from '../format.js'
import { classeStatut, libelleStatut } from '../statuts.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { Chargement, EtatVide } from '../composants/Etats.jsx'

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

  if (chargement) return <Chargement />
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

      <div className="grille-cartes">
        <section className="carte carte--chiffre">
          <h2 className="carte__etiquette">Ventes du jour</h2>
          <p className="chiffre">{estProprietaire ? fcfa(jour.total) : `${jour.nb}`}</p>
          <p className="texte-gris texte-petit">
            {estProprietaire
              ? `${jour.nb} commande(s) · panier moyen ${fcfa(jour.panier_moyen)}`
              : `commande(s) enregistrée(s) aujourd'hui`}
          </p>
          <p className="texte-gris texte-petit">
            {jour.nb_comptoir} au comptoir · {jour.nb_en_ligne} en ligne
          </p>
        </section>

        <section className="carte carte--chiffre">
          <h2 className="carte__etiquette">Commandes à traiter</h2>
          <p className="chiffre">{attente.total}</p>
          <div className="rangee" style={{ gap: 6 }}>
            {['nouvelle', 'confirmee', 'en_livraison', 'livree'].map((statut) =>
              attente[statut] > 0 ? (
                <Link key={statut} to={`/admin/commandes?statut=${statut}`} className={classeStatut(statut)}>
                  {attente[statut]} {libelleStatut(statut).toLowerCase()}
                </Link>
              ) : null,
            )}
            {attente.total === 0 && <span className="texte-gris texte-petit">Rien en attente.</span>}
          </div>
          {resume.non_vues > 0 && (
            <p style={{ marginTop: 10 }}>
              <Link to="/admin/commandes">
                {resume.non_vues} commande(s) en ligne pas encore ouverte(s)
              </Link>
            </p>
          )}
        </section>

        <section className="carte carte--chiffre">
          <h2 className="carte__etiquette">Stock en alerte</h2>
          <p className="chiffre">{alertes.nb}</p>
          {alertes.nb === 0 ? (
            <p className="texte-gris texte-petit">Aucune variante sous son seuil.</p>
          ) : (
            <ul className="liste-simple">
              {alertes.liste.map((alerte) => (
                <li key={alerte.variante_id}>
                  <Link to={`/admin/produits/${alerte.produit_id}`}>{alerte.produit_nom}</Link>
                  <span className="texte-gris"> · {alerte.libelle}</span>
                  <span className="etiquette etiquette--alerte" style={{ marginLeft: 6 }}>
                    {alerte.quantite}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 10 }}>
            <Link to="/admin/stock">Ouvrir le stock</Link>
          </p>
        </section>

        {estProprietaire && resume.valeur_stock && (
          <section className="carte carte--chiffre">
            <h2 className="carte__etiquette">Valeur du stock</h2>
            <p className="chiffre">{fcfa(resume.valeur_stock.prix_vente)}</p>
            <p className="texte-gris texte-petit">
              au prix de vente · {fcfa(resume.valeur_stock.prix_achat)} au prix d'achat
            </p>
          </section>
        )}
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
