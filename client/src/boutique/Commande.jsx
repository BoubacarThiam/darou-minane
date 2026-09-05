import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { fcfa } from '../format.js'
import { usePanier } from '../panier.jsx'
import { useBoutique } from '../boutique.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Message } from '../composants/Etats.jsx'

export const CLE_CONFIRMATION = 'darou-minane.derniere-commande'

/** Tunnel de commande en un seul écran : pas de compte, pas d'étapes. */
export default function Commande() {
  const { lignes, total, articles, vider } = usePanier()
  const boutique = useBoutique()
  const navigation = useNavigate()

  const [valeurs, setValeurs] = useState({
    client_nom: '',
    client_telephone: '',
    client_quartier: '',
    client_note: '',
  })
  const [champs, setChamps] = useState({})
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  if (lignes.length === 0) return <Navigate to="/panier" replace />

  const modifier = (cle) => (evenement) => setValeurs({ ...valeurs, [cle]: evenement.target.value })

  async function envoyer(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      const commande = await api.post('/commandes', {
        ...valeurs,
        lignes: lignes.map(({ variante_id, quantite }) => ({ variante_id, quantite })),
      })
      try {
        window.sessionStorage.setItem(CLE_CONFIRMATION, JSON.stringify(commande))
      } catch {
        // sans stockage, la confirmation reste affichée mais ne survit pas au rechargement
      }
      vider()
      navigation('/commande/confirmation', { replace: true, state: { commande } })
    } catch (probleme) {
      if (probleme instanceof ErreurApi) {
        setErreur(probleme.message)
        setChamps(probleme.champs)
      } else {
        setErreur('Envoi impossible. Vérifiez votre connexion et réessayez.')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="pile-large">
      <div className="fil-ariane">
        <Link to="/panier">Panier</Link>
        <span aria-hidden="true">·</span>
        <span>Commande</span>
      </div>

      <h1>Votre commande</h1>
      <Message ton="erreur">{erreur}</Message>

      <div className="commande">
        <form className="commande__formulaire" onSubmit={envoyer}>
          <Champ
            libelle="Votre nom"
            value={valeurs.client_nom}
            erreur={champs.client_nom}
            onChange={modifier('client_nom')}
            autoComplete="name"
            required
          />
          <Champ
            libelle="Téléphone"
            type="tel"
            inputMode="tel"
            value={valeurs.client_telephone}
            erreur={champs.client_telephone}
            onChange={modifier('client_telephone')}
            placeholder="77 000 00 00"
            aide="C'est par ce numéro que nous confirmons la livraison."
            autoComplete="tel"
            required
          />
          <Champ
            libelle="Quartier et repère"
            value={valeurs.client_quartier}
            erreur={champs.client_quartier}
            onChange={modifier('client_quartier')}
            placeholder="Quartier Pont, près de la pharmacie Diallo"
            required
          />
          <Champ libelle="Précision (facultatif)" erreur={champs.client_note}>
            {(commun) => (
              <textarea
                {...commun}
                value={valeurs.client_note}
                onChange={modifier('client_note')}
                placeholder="Heure de passage, couleur souhaitée, cadeau…"
              />
            )}
          </Champ>

          <button type="submit" className="bouton bouton--grand bouton--plein" disabled={envoi}>
            {envoi ? 'Envoi…' : 'Envoyer ma commande'}
          </button>
          <p className="texte-gris texte-petit" style={{ marginTop: 10 }}>
            Nous vous rappelons pour confirmer le montant de la livraison. Vous payez à la
            livraison, en main propre.
          </p>
        </form>

        <aside className="commande__recap">
          <h2>Récapitulatif</h2>
          <ul className="lignes-commande">
            {lignes.map((ligne) => (
              <li key={ligne.variante_id}>
                <span className="lignes-commande__nom">
                  {ligne.produit_nom}
                  <span className="texte-gris texte-petit">
                    {ligne.libelle} · {ligne.quantite} × {fcfa(ligne.prix)}
                  </span>
                </span>
                <span className="article__prix">{fcfa(ligne.prix * ligne.quantite)}</span>
              </li>
            ))}
          </ul>
          <div className="recapitulatif__ligne">
            <span>{articles} article(s)</span>
            <strong>{fcfa(total)}</strong>
          </div>
          <div className="recapitulatif__ligne texte-gris">
            <span>Livraison à {boutique.zone_livraison}</span>
            <span>à convenir</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
