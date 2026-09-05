import { Link, useLocation } from 'react-router-dom'
import { fcfa } from '../format.js'
import { useBoutique } from '../boutique.jsx'
import { EtatVide } from '../composants/Etats.jsx'
import { IconeWhatsApp } from '../composants/Icones.jsx'
import { CLE_CONFIRMATION } from './Commande.jsx'

function lireDerniereCommande() {
  try {
    const brut = window.sessionStorage.getItem(CLE_CONFIRMATION)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

export default function Confirmation() {
  const emplacement = useLocation()
  const boutique = useBoutique()
  const commande = emplacement.state?.commande ?? lireDerniereCommande()

  if (!commande) {
    return (
      <EtatVide titre="Aucune commande à afficher">
        <p className="texte-petit">
          <Link to="/">Revenir à la boutique</Link>
        </p>
      </EtatVide>
    )
  }

  return (
    <div className="pile-large confirmation">
      <div className="confirmation__entete">
        <span className="confirmation__pastille" aria-hidden="true">✓</span>
        <h1>Merci, votre commande est enregistrée</h1>
        <p className="texte-gris">
          Référence <strong>{commande.reference}</strong>. Nous vous appelons pour confirmer la
          livraison et son montant.
        </p>
      </div>

      <div className="carte">
        <ul className="lignes-commande">
          {commande.lignes.map((ligne, index) => (
            <li key={index}>
              <span className="lignes-commande__nom">
                {ligne.libelle}
                <span className="texte-gris texte-petit">
                  {ligne.quantite} × {fcfa(ligne.prix_unitaire)}
                </span>
              </span>
              <span className="article__prix">{fcfa(ligne.total_ligne)}</span>
            </li>
          ))}
        </ul>
        <div className="recapitulatif__ligne">
          <span>Total des articles</span>
          <strong>{fcfa(commande.total)}</strong>
        </div>
        <div className="recapitulatif__ligne texte-gris">
          <span>Livraison à {boutique.zone_livraison}</span>
          <span>à convenir</span>
        </div>
        <p className="texte-gris texte-petit" style={{ marginTop: 8 }}>
          Paiement à la livraison.
        </p>
      </div>

      <div className="rangee">
        <a className="bouton bouton--grand" href={commande.whatsapp} target="_blank" rel="noreferrer">
          <IconeWhatsApp style={{ width: 20, height: 20 }} />
          Suivre ma commande sur WhatsApp
        </a>
        <Link className="bouton bouton--discret bouton--grand" to="/catalogue">
          Continuer mes achats
        </Link>
      </div>
    </div>
  )
}
