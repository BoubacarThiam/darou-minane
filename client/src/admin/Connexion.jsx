import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Message } from '../composants/Etats.jsx'
import { ErreurApi } from '../api.js'

export default function Connexion() {
  const { utilisateur, connexion, chargement } = useAuth()
  const navigation = useNavigate()
  const emplacement = useLocation()

  const [telephone, setTelephone] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [champs, setChamps] = useState({})
  const [envoi, setEnvoi] = useState(false)

  if (!chargement && utilisateur) {
    return <Navigate to={emplacement.state?.depuis ?? '/admin'} replace />
  }

  async function soumettre(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      await connexion(telephone, motDePasse)
      navigation(emplacement.state?.depuis ?? '/admin', { replace: true })
    } catch (probleme) {
      setErreur(probleme instanceof ErreurApi ? probleme.message : 'Connexion impossible.')
      if (probleme instanceof ErreurApi) setChamps(probleme.champs)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="connexion">
      <form className="connexion__carte" onSubmit={soumettre}>
        <div className="connexion__marque">
          <h1>
            Darou <span style={{ color: 'var(--rose-fonce)' }}>Minane</span>
          </h1>
          <p className="connexion__slogan">Groupe Business Communication 626</p>
        </div>

        <Message ton="erreur">{erreur}</Message>

        <Champ
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="77 338 55 35"
          value={telephone}
          erreur={champs.telephone}
          onChange={(evenement) => setTelephone(evenement.target.value)}
          required
          autoFocus
        />

        <Champ
          libelle="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={motDePasse}
          erreur={champs.mot_de_passe}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
          required
        />

        <button type="submit" className="bouton bouton--plein bouton--grand" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
