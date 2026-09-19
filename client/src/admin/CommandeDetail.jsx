import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { dateCourte, fcfa } from '../format.js'
import { actionStatut, CANAUX, classeStatut, libelleStatut, PAIEMENTS } from '../statuts.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { useNotifications } from '../notifications.jsx'
import { Chargement, Message } from '../composants/Etats.jsx'
import { Modale } from '../composants/Modale.jsx'
import { IconeWhatsApp } from '../composants/Icones.jsx'

export default function CommandeDetail() {
  const { id } = useParams()
  const { estProprietaire } = useAuth()
  const toasts = useToasts()
  const { rafraichir: rafraichirBadge } = useNotifications()

  const [commande, setCommande] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [annulation, setAnnulation] = useState(false)
  const [verification, setVerification] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      setCommande(await api.get(`/admin/commandes/${id}`))
      // L'ouverture éteint le badge côté serveur : on le resynchronise ici.
      rafraichirBadge()
    } catch (probleme) {
      setErreur(probleme instanceof ErreurApi ? probleme.message : 'Commande introuvable.')
    } finally {
      setChargement(false)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { charger() }, [charger])

  async function changerStatut(statut) {
    setEnvoi(true)
    try {
      const misAJour = await api.put(`/admin/commandes/${id}/statut`, { statut })
      setCommande(misAJour)
      toasts.succes(
        statut === 'annulee'
          ? 'Commande annulée, le stock a été restitué.'
          : statut === 'livree' && misAJour.statut === 'payee'
            ? 'Commande livrée. Déjà payée par mobile money : elle est terminée.'
            : `Commande ${libelleStatut(statut).toLowerCase()}.`,
      )
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Changement impossible.')
    } finally {
      setEnvoi(false)
      setAnnulation(false)
    }
  }

  async function verifierPaiement() {
    setVerification(true)
    try {
      const misAJour = await api.post(`/admin/commandes/${id}/paiement/verifier`)
      setCommande(misAJour)
      if (misAJour.paiement?.injoignable) toasts.erreur('SasPay ne répond pas. Réessayez dans un moment.')
      else if (misAJour.paiement?.statut === 'paye') toasts.succes('Paiement reçu.')
      else toasts.succes('Toujours pas de paiement du client.')
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Vérification impossible.')
    } finally {
      setVerification(false)
    }
  }

  if (chargement) return <Chargement />
  if (erreur) return <Message ton="erreur">{erreur}</Message>

  const suites = (commande.transitions ?? []).filter((statut) => statut !== 'annulee')
  const annulable = (commande.transitions ?? []).includes('annulee')
  const payeeEnLigne = Boolean(commande.paye_en_ligne_le)
  const paiementDejaEncaisse = commande.statut === 'payee' || payeeEnLigne
  const paiement = commande.paiement
  const articlesRendus = commande.lignes.reduce((somme, ligne) => somme + ligne.quantite, 0)

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>{commande.reference}</h1>
          <p>
            <Link to="/admin/commandes">Retour aux commandes</Link> · {CANAUX[commande.canal]} ·{' '}
            {dateCourte(commande.created_at)}
            {commande.vendeur ? ` · ${commande.vendeur}` : ''}
          </p>
        </div>
        <div className="entete-page__actions">
          <span className={classeStatut(commande.statut)}>{libelleStatut(commande.statut)}</span>
        </div>
      </div>

      {commande.statut === 'annulee' && (
        <Message ton="info">Cette commande est annulée : son stock a été restitué.</Message>
      )}

      <div className="carte">
        <div className="carte__titre">
          <h2>Client</h2>
        </div>
        <dl className="fiche-donnees">
          <div>
            <dt>Nom</dt>
            <dd>{commande.client_nom}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>
              {commande.client_telephone ? (
                <a href={`tel:+${commande.client_telephone}`}>+{commande.client_telephone}</a>
              ) : (
                <span className="texte-gris">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Quartier ou repère</dt>
            <dd>{commande.client_quartier || <span className="texte-gris">—</span>}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd>à convenir</dd>
          </div>
        </dl>
        {commande.client_note && (
          <p className="message message--info" style={{ marginTop: 12, marginBottom: 0 }}>
            « {commande.client_note} »
          </p>
        )}
        {commande.whatsapp?.client && (
          <a
            className="bouton bouton--discret"
            style={{ marginTop: 14 }}
            href={commande.whatsapp.client}
            target="_blank"
            rel="noreferrer"
          >
            <IconeWhatsApp style={{ width: 20, height: 20 }} />
            Écrire au client sur WhatsApp
          </a>
        )}
      </div>

      {commande.mode_paiement === 'mobile_money' && (
        <div className="carte">
          <div className="carte__titre">
            <h2>Paiement</h2>
            {paiement && (
              <span className={PAIEMENTS[paiement.statut]?.classe ?? 'etiquette'}>
                {PAIEMENTS[paiement.statut]?.libelle ?? paiement.statut}
              </span>
            )}
          </div>
          {paiement && (
            <dl className="fiche-donnees">
              <div>
                <dt>Moyen</dt>
                <dd>Mobile money (SasPay)</dd>
              </div>
              <div>
                <dt>Montant</dt>
                <dd>{fcfa(paiement.montant)}</dd>
              </div>
              {paiement.paye_le && (
                <div>
                  <dt>Reçu le</dt>
                  <dd>{dateCourte(paiement.paye_le)}</dd>
                </div>
              )}
              {paiement.montant_net !== null && (
                <div>
                  <dt>Net après frais</dt>
                  <dd>{fcfa(paiement.montant_net)}</dd>
                </div>
              )}
              {paiement.reference_externe && (
                <div>
                  <dt>Référence SasPay</dt>
                  <dd>{paiement.reference_externe}</dd>
                </div>
              )}
            </dl>
          )}
          {paiement?.injoignable && (
            <p className="message message--erreur" style={{ marginTop: 12, marginBottom: 0 }}>
              SasPay ne répond pas pour le moment : l'état affiché est le dernier connu.
            </p>
          )}
          {payeeEnLigne && commande.statut === 'annulee' && (
            <p className="message message--erreur" style={{ marginTop: 12, marginBottom: 0 }}>
              Commande annulée alors que le client a payé : pensez à le rembourser.
            </p>
          )}
          {paiement?.statut === 'en_attente' && (
            <>
              <p className="texte-gris texte-petit" style={{ marginTop: 12 }}>
                Le client n'a pas encore validé le paiement sur son téléphone. Il est revérifié à
                chaque ouverture de la commande ; sinon, encaissez à la livraison.
              </p>
              <button
                type="button"
                className="bouton bouton--discret"
                disabled={verification}
                onClick={verifierPaiement}
              >
                {verification ? 'Vérification…' : 'Vérifier le paiement'}
              </button>
            </>
          )}
          {(paiement?.statut === 'expire' || paiement?.statut === 'annule') && !payeeEnLigne && (
            <p className="texte-gris texte-petit" style={{ marginTop: 12, marginBottom: 0 }}>
              Le paiement en ligne n'a pas abouti : encaissez à la livraison.
            </p>
          )}
        </div>
      )}

      <div className="carte">
        <div className="carte__titre">
          <h2>Articles</h2>
        </div>
        <ul className="lignes-commande">
          {commande.lignes.map((ligne) => (
            <li key={ligne.id}>
              {/* La photo aide à préparer la commande : on va chercher en rayon
                  le coffret qu'on reconnaît, pas un nom qu'on relit. */}
              {ligne.image ? (
                <img
                  className="lignes-commande__photo"
                  src={ligne.image}
                  srcSet={ligne.image_srcset ?? undefined}
                  sizes="64px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="lignes-commande__photo" aria-hidden="true" />
              )}
              <span className="lignes-commande__nom">
                {ligne.produit_id ? (
                  <Link to={`/admin/produits/${ligne.produit_id}`}>{ligne.libelle}</Link>
                ) : (
                  ligne.libelle
                )}
                <span className="texte-gris texte-petit">
                  {ligne.quantite} × {fcfa(ligne.prix_unitaire)}
                </span>
              </span>
              <span className="article__prix">{fcfa(ligne.total_ligne)}</span>
            </li>
          ))}
        </ul>
        <div className="panier__total" style={{ marginBottom: 0 }}>
          <span className="texte-gris">Total des articles · livraison à convenir</span>
          <strong>{fcfa(commande.total)}</strong>
        </div>
      </div>

      <div className="carte">
        <div className="carte__titre">
          <h2>Suivi</h2>
        </div>
        {suites.length === 0 && !annulable ? (
          <p className="texte-gris texte-petit">
            Cette commande est terminée : plus aucun changement de statut n'est possible.
          </p>
        ) : (
          <div className="rangee">
            {suites.map((statut) => (
              <button
                key={statut}
                type="button"
                className="bouton"
                disabled={envoi}
                onClick={() => changerStatut(statut)}
              >
                {actionStatut(statut)}
              </button>
            ))}
            {annulable && (
              <button
                type="button"
                className="bouton bouton--danger pousse-droite"
                disabled={envoi || (paiementDejaEncaisse && !estProprietaire)}
                onClick={() => setAnnulation(true)}
              >
                Annuler la commande
              </button>
            )}
          </div>
        )}
        {annulable && paiementDejaEncaisse && !estProprietaire && (
          <p className="champ__aide" style={{ marginTop: 10 }}>
            Annuler une commande déjà payée est réservé au propriétaire.
          </p>
        )}
      </div>

      {annulation && (
        <Modale
          titre={`Annuler ${commande.reference} ?`}
          onFermer={() => setAnnulation(false)}
          actions={
            <>
              <button type="button" className="bouton bouton--discret" onClick={() => setAnnulation(false)}>
                Revenir
              </button>
              <button type="button" className="bouton bouton--danger" disabled={envoi} onClick={() => changerStatut('annulee')}>
                {envoi ? 'Annulation…' : 'Annuler la commande'}
              </button>
            </>
          }
        >
          <p>
            {articlesRendus > 1
              ? `Les ${articlesRendus} articles de cette commande retournent en stock,`
              : "L'article de cette commande retourne en stock,"}{' '}
            avec un mouvement « retour » à l'appui.
            {payeeEnLigne
              ? ' Le client a déjà payé par mobile money : pensez à le rembourser.'
              : paiementDejaEncaisse && ' Cette commande a déjà été encaissée : pensez au remboursement.'}
          </p>
          <p className="texte-petit texte-gris" style={{ marginTop: 8 }}>
            Une commande annulée ne peut pas être rouverte.
          </p>
        </Modale>
      )}
    </div>
  )
}
