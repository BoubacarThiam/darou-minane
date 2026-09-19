import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { fcfa } from '../format.js'
import { Chargement, EtatVide, Message } from '../composants/Etats.jsx'
import { ActionsCommande, RecapCommande } from './Confirmation.jsx'

/** Relectures automatiques quand l'opérateur n'a pas encore confirmé. */
const RELECTURES_MAX = 6
const INTERVALLE = 5000

/**
 * Relais du paiement mobile money, à l'adresse /commande/paiement?j=<jeton>.
 *
 * À l'aller, la page part vers SasPay. Au retour (redirection de SasPay
 * après succès, ou bouton « retour » du téléphone), elle demande au
 * serveur de relire le paiement : c'est le serveur qui interroge SasPay,
 * cette page ne décide jamais seule qu'une commande est payée.
 */
export default function PaiementRetour() {
  const [parametres] = useSearchParams()
  const jeton = parametres.get('j') ?? ''
  const emplacement = useLocation()
  const navigation = useNavigate()
  const redirection = emplacement.state?.redirection

  const [etat, setEtat] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [verification, setVerification] = useState(false)
  const relectures = useRef(0)

  // Le « retour » du téléphone peut restaurer la page figée telle qu'on
  // l'a quittée (« Redirection… ») : on la recharge pour relire le paiement.
  useEffect(() => {
    const surRetour = (evenement) => { if (evenement.persisted) window.location.reload() }
    window.addEventListener('pageshow', surRetour)
    return () => window.removeEventListener('pageshow', surRetour)
  }, [])

  useEffect(() => {
    if (!redirection) return
    // L'état est effacé avant de partir : un rechargement ne relance pas le départ.
    navigation(`${emplacement.pathname}${emplacement.search}`, { replace: true, state: null })
    window.location.assign(redirection)
  }, [redirection]) // eslint-disable-line react-hooks/exhaustive-deps

  const verifier = useCallback(async () => {
    setVerification(true)
    try {
      setEtat(await api.post('/paiements/verifier', { jeton }))
      setErreur(null)
    } catch (probleme) {
      setErreur(
        probleme instanceof ErreurApi ? probleme.message : 'Vérification impossible. Vérifiez votre connexion.',
      )
    } finally {
      setVerification(false)
    }
  }, [jeton])

  useEffect(() => {
    if (!redirection && jeton) verifier()
  }, [verifier, redirection, jeton])

  // Revenu quelques secondes avant la confirmation de l'opérateur : on relit.
  useEffect(() => {
    if (etat?.paiement?.statut !== 'en_attente' || relectures.current >= RELECTURES_MAX) return
    const minuteur = window.setTimeout(() => {
      relectures.current += 1
      verifier()
    }, INTERVALLE)
    return () => window.clearTimeout(minuteur)
  }, [etat, verifier])

  if (redirection) return <Chargement texte="Ouverture de la page de paiement…" />
  if (!jeton) {
    return (
      <EtatVide titre="Lien de paiement incomplet">
        <p className="texte-petit"><Link to="/">Revenir à la boutique</Link></p>
      </EtatVide>
    )
  }
  if (!etat) {
    return erreur ? (
      <div className="pile-large">
        <Message ton="erreur">{erreur}</Message>
        <button type="button" className="bouton" onClick={verifier} disabled={verification}>
          Réessayer
        </button>
      </div>
    ) : (
      <Chargement texte="Vérification du paiement…" />
    )
  }

  const { paiement } = etat
  const paye = paiement.statut === 'paye'
  const attente = paiement.statut === 'en_attente' && !etat.annulee

  return (
    <div className="pile-large confirmation">
      <div className="confirmation__entete">
        <span
          className={paye ? 'confirmation__pastille' : 'confirmation__pastille confirmation__pastille--attente'}
          aria-hidden="true"
        >
          {paye ? '✓' : '…'}
        </span>
        <h1 aria-live="polite">
          {paye
            ? 'Merci, votre paiement est reçu'
            : etat.annulee
              ? 'Cette commande a été annulée'
              : attente
                ? 'Paiement pas encore reçu'
                : 'Votre commande est enregistrée'}
        </h1>
        <p className="texte-gris">
          Référence <strong>{etat.reference}</strong>.{' '}
          {paye
            ? 'Nous vous appelons pour convenir de la livraison.'
            : attente
              ? 'Si vous venez de valider sur votre téléphone, la confirmation arrive en quelques secondes.'
              : etat.annulee
                ? 'Écrivez-nous sur WhatsApp pour toute question.'
                : 'La page de paiement n\'est plus valable : vous paierez à la livraison.'}
        </p>
      </div>

      {paiement.injoignable && (
        <Message ton="info">
          Le service de paiement ne répond pas pour l'instant. Votre commande est bien enregistrée ;
          réessayez la vérification dans un moment.
        </Message>
      )}
      <Message ton="erreur">{erreur}</Message>

      {attente && (
        <div className="rangee">
          {paiement.url && (
            <a className="bouton bouton--grand bouton--plein" href={paiement.url}>
              Payer {fcfa(etat.total)} maintenant
            </a>
          )}
          <button
            type="button"
            className="bouton bouton--discret bouton--grand"
            onClick={() => { relectures.current = 0; verifier() }}
            disabled={verification}
          >
            {verification ? 'Vérification…' : 'J\'ai payé, vérifier'}
          </button>
        </div>
      )}

      <RecapCommande
        commande={etat}
        paiement={
          paye
            ? `Articles payés : ${fcfa(etat.total)}. La livraison se règle à la réception.`
            : 'Vous pouvez aussi payer à la livraison, en espèces.'
        }
      />
      <ActionsCommande commande={etat} />
    </div>
  )
}
