import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { ErreurApi } from '../api.js'
import {
  IconeCadenas,
  IconeFleche,
  IconeOeil,
  IconeOeilBarre,
  IconeTelephone,
} from '../composants/Icones.jsx'

/**
 * Écran de connexion du back-office.
 *
 * Traitement sombre et doré, à la demande du propriétaire : le back-office
 * s'ouvre sur un écran d'atelier plutôt que sur un formulaire blanc.
 */
export default function Connexion() {
  const { utilisateur, connexion, deconnexion, chargement } = useAuth()
  const navigation = useNavigate()
  const emplacement = useLocation()
  const idTel = useId()
  const idMdp = useId()
  const sessionFermee = useRef(false)

  const [telephone, setTelephone] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [motDePasseVisible, setMotDePasseVisible] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [champs, setChamps] = useState({})
  const [envoi, setEnvoi] = useState(false)

  /* La porte d'entrée demande toujours les identifiants, même si une session
     est encore ouverte : le téléphone de la boutique passe de main en main.
     Arriver ici ferme donc la session en cours au lieu de la reprendre. */
  useEffect(() => {
    if (chargement || !utilisateur || sessionFermee.current) return
    sessionFermee.current = true
    deconnexion()
  }, [chargement, utilisateur, deconnexion])

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
    <div className="portail">
      <div className="portail__halo" aria-hidden="true" />

      <form className="portail__carte" onSubmit={soumettre}>
        <div className="portail__marque">
          {/* Marque dessinée en fil de fer, dans l'or de l'écran. */}
          <svg className="portail__sceau" viewBox="0 0 64 64" aria-hidden="true">
            <path
              d="M32 6 56 19v26L32 58 8 45V19z M32 6v26m0 0 24-13M32 32 8 19m24 13v26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <h1 className="portail__titre">Bon retour</h1>
          <p className="portail__slogan">Darou Minane — Groupe Business Communication 626</p>
        </div>

        {erreur && (
          <p className="portail__erreur" role="alert">
            {erreur}
          </p>
        )}

        <div className="portail__champ">
          <label htmlFor={idTel}>Téléphone</label>
          <div className="portail__saisie">
            <IconeTelephone className="portail__icone" />
            <input
              id={idTel}
              type="tel"
              inputMode="tel"
              autoComplete="username"
              placeholder="77 338 55 35"
              value={telephone}
              onChange={(evenement) => setTelephone(evenement.target.value)}
              aria-invalid={champs.telephone ? 'true' : undefined}
              aria-describedby={champs.telephone ? `${idTel}-erreur` : undefined}
              required
              autoFocus
            />
          </div>
          {champs.telephone && (
            <span className="portail__champ-erreur" id={`${idTel}-erreur`}>
              {champs.telephone}
            </span>
          )}
        </div>

        <div className="portail__champ">
          <label htmlFor={idMdp}>Mot de passe</label>
          <div className="portail__saisie">
            <IconeCadenas className="portail__icone" />
            <input
              id={idMdp}
              type={motDePasseVisible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              value={motDePasse}
              onChange={(evenement) => setMotDePasse(evenement.target.value)}
              aria-invalid={champs.mot_de_passe ? 'true' : undefined}
              aria-describedby={champs.mot_de_passe ? `${idMdp}-erreur` : undefined}
              required
            />
            <button
              type="button"
              className="portail__oeil"
              onClick={() => setMotDePasseVisible((visible) => !visible)}
              aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={motDePasseVisible}
            >
              {motDePasseVisible ? <IconeOeilBarre /> : <IconeOeil />}
            </button>
          </div>
          {champs.mot_de_passe && (
            <span className="portail__champ-erreur" id={`${idMdp}-erreur`}>
              {champs.mot_de_passe}
            </span>
          )}
        </div>

        {/* Le bouton ne s'active qu'une fois les deux champs saisis : on
            n'envoie pas une demande vouée à revenir en erreur. */}
        <button
          type="submit"
          className="portail__bouton"
          disabled={envoi || telephone.trim() === '' || motDePasse === ''}
        >
          {envoi ? 'Connexion…' : 'Se connecter'}
          <IconeFleche className="portail__bouton-fleche" />
        </button>

        <p className="portail__aide">
          Mot de passe oublié ? Demandez au propriétaire de le réinitialiser.
        </p>

        <div className="portail__separateur">
          <span>ou</span>
        </div>

        <Link className="portail__retour" to="/">
          Retourner à la boutique
        </Link>
      </form>
    </div>
  )
}
