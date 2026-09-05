import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Message } from '../composants/Etats.jsx'

export default function Compte() {
  const { utilisateur, deconnexion, estProprietaire } = useAuth()
  const toasts = useToasts()

  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [champs, setChamps] = useState({})
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  async function changerMotDePasse(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      await api.put('/auth/mot-de-passe', {
        mot_de_passe_actuel: actuel,
        nouveau_mot_de_passe: nouveau,
      })
      toasts.succes('Mot de passe modifié.')
      setActuel('')
      setNouveau('')
    } catch (probleme) {
      if (probleme instanceof ErreurApi) {
        setErreur(probleme.message)
        setChamps(probleme.champs)
      } else {
        setErreur('Modification impossible.')
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Mon compte</h1>
          <p>
            {utilisateur.nom} · {utilisateur.role === 'proprietaire' ? 'Propriétaire' : 'Employé'} ·{' '}
            {utilisateur.telephone}
          </p>
        </div>
      </div>

      <form className="carte" onSubmit={changerMotDePasse} style={{ maxWidth: 420 }}>
        <h2 className="carte__titre">Changer mon mot de passe</h2>
        <Message ton="erreur">{erreur}</Message>
        <Champ
          libelle="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={actuel}
          erreur={champs.mot_de_passe_actuel}
          onChange={(evenement) => setActuel(evenement.target.value)}
          required
        />
        <Champ
          libelle="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={nouveau}
          erreur={champs.nouveau_mot_de_passe}
          onChange={(evenement) => setNouveau(evenement.target.value)}
          aide="Six caractères au minimum."
          required
        />
        <button type="submit" className="bouton" disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      {estProprietaire && (
        <div className="carte" style={{ maxWidth: 420 }}>
          <h2 className="carte__titre">Équipe</h2>
          <p className="texte-gris texte-petit" style={{ marginBottom: 12 }}>
            Créer un compte employé, changer un rôle ou retirer un accès.
          </p>
          <Link className="bouton bouton--discret" to="/admin/equipe">
            Gérer les comptes
          </Link>
        </div>
      )}

      <button type="button" className="bouton bouton--discret" onClick={deconnexion}>
        Se déconnecter
      </button>
    </div>
  )
}
