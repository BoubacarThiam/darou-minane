import { useCallback, useEffect, useState } from 'react'
import { api, ErreurApi } from '../api.js'
import { dateCourte } from '../format.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Chargement, Message } from '../composants/Etats.jsx'
import { Modale } from '../composants/Modale.jsx'

/** Comptes du back-office — écran réservé au propriétaire. */
export default function Comptes() {
  const { utilisateur } = useAuth()
  const toasts = useToasts()
  const [comptes, setComptes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [edite, setEdite] = useState(null) // {} = création, {id,...} = modification

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      setComptes(await api.get('/admin/utilisateurs'))
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }, [toasts])

  useEffect(() => { charger() }, [charger])

  async function basculerActif(compte) {
    try {
      if (compte.actif) {
        await api.supprimer(`/admin/utilisateurs/${compte.id}`)
        toasts.succes(`${compte.nom} n'a plus accès au back-office.`)
      } else {
        await api.put(`/admin/utilisateurs/${compte.id}`, { actif: true })
        toasts.succes(`${compte.nom} peut de nouveau se connecter.`)
      }
      charger()
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Modification impossible.')
    }
  }

  if (chargement) return <Chargement />

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Comptes de l'équipe</h1>
          <p>Qui peut ouvrir le back-office et jusqu'où.</p>
        </div>
        <div className="entete-page__actions">
          <button type="button" className="bouton" onClick={() => setEdite({})}>
            Nouveau compte
          </button>
        </div>
      </div>

      <div className="carte">
        <div className="tableau--defilant">
          <table className="tableau">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Rôle</th>
                <th>État</th>
                <th>Dernière connexion</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {comptes.map((compte) => (
                <tr key={compte.id}>
                  <td>
                    {compte.nom}
                    {compte.id === utilisateur.id && <span className="texte-gris"> (vous)</span>}
                  </td>
                  <td>{compte.telephone}</td>
                  <td>{compte.role === 'proprietaire' ? 'Propriétaire' : 'Employé'}</td>
                  <td>
                    <span className={compte.actif ? 'etiquette etiquette--succes' : 'etiquette'}>
                      {compte.actif ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="texte-petit texte-gris">
                    {compte.dernier_login ? dateCourte(compte.dernier_login) : 'jamais'}
                  </td>
                  <td>
                    <div className="rangee" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="bouton bouton--discret bouton--petit"
                        onClick={() => setEdite(compte)}
                      >
                        Modifier
                      </button>
                      {compte.id !== utilisateur.id && (
                        <button
                          type="button"
                          className={compte.actif ? 'bouton bouton--danger bouton--petit' : 'bouton bouton--petit'}
                          onClick={() => basculerActif(compte)}
                        >
                          {compte.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="champ__aide" style={{ marginTop: 10 }}>
          Un compte n'est jamais supprimé : il est désactivé, pour que les ventes et les
          mouvements de stock restent attribués à leur auteur.
        </p>
      </div>

      {edite && (
        <ModaleCompte
          compte={edite}
          onFermer={() => setEdite(null)}
          onEnregistre={() => {
            setEdite(null)
            charger()
          }}
        />
      )}
    </div>
  )
}

function ModaleCompte({ compte, onFermer, onEnregistre }) {
  const creation = compte.id === undefined
  const toasts = useToasts()
  const [valeurs, setValeurs] = useState({
    nom: compte.nom ?? '',
    telephone: compte.telephone ?? '',
    role: compte.role ?? 'employe',
    mot_de_passe: '',
  })
  const [champs, setChamps] = useState({})
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      if (creation) {
        await api.post('/admin/utilisateurs', valeurs)
        toasts.succes(`Compte de ${valeurs.nom} créé.`)
      } else {
        await api.put(`/admin/utilisateurs/${compte.id}`, {
          nom: valeurs.nom,
          telephone: valeurs.telephone,
          role: valeurs.role,
          ...(valeurs.mot_de_passe ? { mot_de_passe: valeurs.mot_de_passe } : {}),
        })
        toasts.succes('Compte enregistré.')
      }
      onEnregistre()
    } catch (probleme) {
      if (probleme instanceof ErreurApi) {
        setErreur(probleme.message)
        setChamps(probleme.champs)
      } else {
        setErreur('Enregistrement impossible.')
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Modale titre={creation ? 'Nouveau compte' : `Modifier ${compte.nom}`} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <Message ton="erreur">{erreur}</Message>
        <Champ
          libelle="Nom"
          value={valeurs.nom}
          erreur={champs.nom}
          onChange={(evenement) => setValeurs({ ...valeurs, nom: evenement.target.value })}
          required
        />
        <Champ
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          value={valeurs.telephone}
          erreur={champs.telephone}
          onChange={(evenement) => setValeurs({ ...valeurs, telephone: evenement.target.value })}
          aide="Sert d'identifiant de connexion."
          required
        />
        <Champ libelle="Rôle" erreur={champs.role}>
          {(commun) => (
            <select
              {...commun}
              value={valeurs.role}
              onChange={(evenement) => setValeurs({ ...valeurs, role: evenement.target.value })}
            >
              <option value="employe">Employé — vente, commandes, entrées de stock</option>
              <option value="proprietaire">Propriétaire — accès complet</option>
            </select>
          )}
        </Champ>
        <Champ
          libelle={creation ? 'Mot de passe' : 'Nouveau mot de passe'}
          type="password"
          autoComplete="new-password"
          value={valeurs.mot_de_passe}
          erreur={champs.mot_de_passe}
          onChange={(evenement) => setValeurs({ ...valeurs, mot_de_passe: evenement.target.value })}
          aide={creation ? 'Six caractères au minimum.' : 'Laissez vide pour le conserver.'}
          required={creation}
        />
        <div className="modale__actions">
          <button type="button" className="bouton bouton--discret" onClick={onFermer}>
            Annuler
          </button>
          <button type="submit" className="bouton" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modale>
  )
}
