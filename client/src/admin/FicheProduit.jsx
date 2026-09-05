import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { fcfa } from '../format.js'
import { useAuth } from '../auth.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { Champ } from '../composants/Champ.jsx'
import { Chargement, Message } from '../composants/Etats.jsx'
import { Modale } from '../composants/Modale.jsx'

const VARIANTE_VIDE = { libelle: '', prix: '', prix_achat: '', quantite: '', seuil_alerte: '3' }

export default function FicheProduit() {
  const { id } = useParams()
  const creation = id === undefined
  const navigation = useNavigate()
  const { estProprietaire } = useAuth()
  const toasts = useToasts()

  const [categories, setCategories] = useState([])
  const [produit, setProduit] = useState(null)
  const [chargement, setChargement] = useState(!creation)
  const [erreur, setErreur] = useState(null)
  const [champs, setChamps] = useState({})
  const [envoi, setEnvoi] = useState(false)

  const [infos, setInfos] = useState({
    nom: '',
    categorie_id: '',
    description: '',
    mis_en_avant: false,
    actif: true,
  })
  const [nouvellesVariantes, setNouvellesVariantes] = useState([{ ...VARIANTE_VIDE }])
  const [varianteEditee, setVarianteEditee] = useState(null)
  const [suppression, setSuppression] = useState(false)

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => setCategories([]))
  }, [])

  const chargerProduit = useCallback(async () => {
    if (creation) return
    setChargement(true)
    try {
      const fiche = await api.get(`/admin/produits/${id}`)
      setProduit(fiche)
      setInfos({
        nom: fiche.nom,
        categorie_id: String(fiche.categorie.id),
        description: fiche.description ?? '',
        mis_en_avant: fiche.mis_en_avant,
        actif: fiche.actif,
      })
    } catch (probleme) {
      setErreur(probleme instanceof ErreurApi ? probleme.message : 'Produit introuvable.')
    } finally {
      setChargement(false)
    }
  }, [creation, id])

  useEffect(() => { chargerProduit() }, [chargerProduit])

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setErreur(null)
    setChamps({})
    setEnvoi(true)
    try {
      if (creation) {
        const cree = await api.post('/admin/produits', {
          ...infos,
          categorie_id: Number(infos.categorie_id),
          variantes: nouvellesVariantes.map((variante) => ({
            libelle: variante.libelle,
            prix: Number(variante.prix),
            ...(variante.prix_achat !== '' ? { prix_achat: Number(variante.prix_achat) } : {}),
            quantite: variante.quantite === '' ? 0 : Number(variante.quantite),
            seuil_alerte: variante.seuil_alerte === '' ? 3 : Number(variante.seuil_alerte),
          })),
        })
        toasts.succes(`${cree.nom} créé. Ajoutez maintenant ses photos.`)
        navigation(`/admin/produits/${cree.id}`, { replace: true })
      } else {
        await api.put(`/admin/produits/${id}`, { ...infos, categorie_id: Number(infos.categorie_id) })
        toasts.succes('Produit enregistré.')
        chargerProduit()
      }
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

  async function supprimerProduit() {
    try {
      const resultat = await api.supprimer(`/admin/produits/${id}`)
      toasts.succes(resultat.message)
      navigation('/admin/produits', { replace: true })
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Suppression impossible.')
    } finally {
      setSuppression(false)
    }
  }

  if (erreur && !produit && !creation) return <Message ton="erreur">{erreur}</Message>
  if (chargement || (!creation && !produit)) return <Chargement />

  const lectureSeule = !estProprietaire

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>{creation ? 'Nouveau produit' : produit.nom}</h1>
          <p>
            <Link to="/admin/produits">Retour aux produits</Link>
            {!creation && ` · ${produit.variantes.length} variante(s)`}
          </p>
        </div>
        {!creation && estProprietaire && (
          <div className="entete-page__actions">
            <button type="button" className="bouton bouton--danger" onClick={() => setSuppression(true)}>
              Retirer le produit
            </button>
          </div>
        )}
      </div>

      {lectureSeule && (
        <Message ton="info">
          Consultation seule : la modification du catalogue est réservée au propriétaire.
        </Message>
      )}

      <form className="carte" onSubmit={enregistrer}>
        <h2 className="carte__titre">Informations</h2>
        <Message ton="erreur">{erreur}</Message>

        <Champ
          libelle="Nom du produit"
          value={infos.nom}
          erreur={champs.nom}
          onChange={(evenement) => setInfos({ ...infos, nom: evenement.target.value })}
          disabled={lectureSeule}
          required
        />

        <Champ libelle="Catégorie" erreur={champs.categorie_id}>
          {(commun) => (
            <select
              {...commun}
              value={infos.categorie_id}
              onChange={(evenement) => setInfos({ ...infos, categorie_id: evenement.target.value })}
              disabled={lectureSeule}
              required
            >
              <option value="">Choisir une catégorie</option>
              {categories.map((categorie) => (
                <option key={categorie.id} value={categorie.id}>
                  {categorie.nom}
                </option>
              ))}
            </select>
          )}
        </Champ>

        <Champ libelle="Description" erreur={champs.description}>
          {(commun) => (
            <textarea
              {...commun}
              value={infos.description}
              onChange={(evenement) => setInfos({ ...infos, description: evenement.target.value })}
              disabled={lectureSeule}
              placeholder="Ce que le client doit savoir : matière, contenance, autonomie…"
            />
          )}
        </Champ>

        <div className="rangee" style={{ marginBottom: 16 }}>
          <label className="rangee" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={infos.mis_en_avant}
              onChange={(evenement) => setInfos({ ...infos, mis_en_avant: evenement.target.checked })}
              disabled={lectureSeule}
              style={{ width: 20, minHeight: 20 }}
            />
            <span>Mis en avant sur l'accueil</span>
          </label>
          <label className="rangee" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={infos.actif}
              onChange={(evenement) => setInfos({ ...infos, actif: evenement.target.checked })}
              disabled={lectureSeule}
              style={{ width: 20, minHeight: 20 }}
            />
            <span>Visible dans la boutique</span>
          </label>
        </div>

        {creation && (
          <VariantesCreation
            variantes={nouvellesVariantes}
            setVariantes={setNouvellesVariantes}
            champs={champs}
          />
        )}

        {!lectureSeule && (
          <button type="submit" className="bouton" disabled={envoi}>
            {envoi ? 'Enregistrement…' : creation ? 'Créer le produit' : 'Enregistrer'}
          </button>
        )}
      </form>

      {!creation && (
        <>
          <Variantes
            produit={produit}
            lectureSeule={lectureSeule}
            onEditer={setVarianteEditee}
            onRafraichir={chargerProduit}
          />
          <Photos produit={produit} lectureSeule={lectureSeule} onRafraichir={chargerProduit} />
        </>
      )}

      {varianteEditee && (
        <ModaleVariante
          produitId={produit.id}
          variante={varianteEditee}
          onFermer={() => setVarianteEditee(null)}
          onEnregistre={() => {
            setVarianteEditee(null)
            chargerProduit()
          }}
        />
      )}

      {suppression && (
        <Modale
          titre="Retirer ce produit ?"
          onFermer={() => setSuppression(false)}
          actions={
            <>
              <button type="button" className="bouton bouton--discret" onClick={() => setSuppression(false)}>
                Annuler
              </button>
              <button type="button" className="bouton bouton--danger" onClick={supprimerProduit}>
                Retirer
              </button>
            </>
          }
        >
          <p>
            S'il a déjà été vendu ou mouvementé, il est simplement retiré de la boutique et son
            historique est conservé. Sinon il est supprimé définitivement.
          </p>
        </Modale>
      )}
    </div>
  )
}

/* --- Variantes saisies à la création -------------------------------- */
function VariantesCreation({ variantes, setVariantes, champs }) {
  function modifier(index, cle, valeur) {
    setVariantes(variantes.map((variante, i) => (i === index ? { ...variante, [cle]: valeur } : variante)))
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
      <legend className="champ__libelle">Variantes</legend>
      <p className="champ__aide" style={{ marginBottom: 12 }}>
        Une ligne par déclinaison (couleur, contenance…). Le stock est porté par la variante :
        la quantité saisie ici entre en stock comme un arrivage.
      </p>

      {variantes.map((variante, index) => (
        <div className="carte" key={index} style={{ background: 'var(--rose-pale)', border: 0 }}>
          <div className="ligne-champs">
            <Champ
              libelle="Libellé"
              value={variante.libelle}
              erreur={champs[`variantes.${index}.libelle`]}
              onChange={(evenement) => modifier(index, 'libelle', evenement.target.value)}
              placeholder="Bois foncé, 100 ml…"
              required
            />
            <Champ
              libelle="Prix de vente (FCFA)"
              type="number"
              inputMode="numeric"
              min="0"
              value={variante.prix}
              erreur={champs[`variantes.${index}.prix`]}
              onChange={(evenement) => modifier(index, 'prix', evenement.target.value)}
              required
            />
            <Champ
              libelle="Prix d'achat (FCFA)"
              type="number"
              inputMode="numeric"
              min="0"
              value={variante.prix_achat}
              erreur={champs[`variantes.${index}.prix_achat`]}
              onChange={(evenement) => modifier(index, 'prix_achat', evenement.target.value)}
              aide="Visible par vous seul."
            />
            <Champ
              libelle="Quantité en stock"
              type="number"
              inputMode="numeric"
              min="0"
              value={variante.quantite}
              erreur={champs[`variantes.${index}.quantite`]}
              onChange={(evenement) => modifier(index, 'quantite', evenement.target.value)}
            />
            <Champ
              libelle="Seuil d'alerte"
              type="number"
              inputMode="numeric"
              min="0"
              value={variante.seuil_alerte}
              erreur={champs[`variantes.${index}.seuil_alerte`]}
              onChange={(evenement) => modifier(index, 'seuil_alerte', evenement.target.value)}
            />
          </div>
          {variantes.length > 1 && (
            <button
              type="button"
              className="bouton-lien"
              onClick={() => setVariantes(variantes.filter((_, i) => i !== index))}
            >
              Retirer cette variante
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="bouton bouton--discret bouton--petit"
        onClick={() => setVariantes([...variantes, { ...VARIANTE_VIDE }])}
      >
        Ajouter une variante
      </button>
      {champs.variantes && <span className="champ__erreur">{champs.variantes}</span>}
    </fieldset>
  )
}

/* --- Variantes d'un produit existant --------------------------------- */
function Variantes({ produit, lectureSeule, onEditer, onRafraichir }) {
  const toasts = useToasts()
  const { estProprietaire } = useAuth()
  const [aRetirer, setARetirer] = useState(null)

  async function retirer() {
    try {
      const resultat = await api.supprimer(`/admin/variantes/${aRetirer.id}`)
      toasts.succes(resultat.message)
      onRafraichir()
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Suppression impossible.')
    } finally {
      setARetirer(null)
    }
  }

  return (
    <div className="carte">
      <div className="carte__titre">
        <h2>Variantes</h2>
        {!lectureSeule && (
          <button
            type="button"
            className="bouton bouton--petit"
            onClick={() => onEditer({ produit_id: produit.id })}
          >
            Ajouter une variante
          </button>
        )}
      </div>

      <div className="tableau--defilant">
        <table className="tableau">
          <thead>
            <tr>
              <th>Libellé</th>
              <th>SKU</th>
              <th>Prix</th>
              {estProprietaire && <th>Achat</th>}
              {estProprietaire && <th>Marge</th>}
              <th>Stock</th>
              <th>Seuil</th>
              <th>État</th>
              {!lectureSeule && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {produit.variantes.map((variante) => (
              <tr key={variante.id}>
                <td>{variante.libelle}</td>
                <td className="texte-petit texte-gris">{variante.sku}</td>
                <td>{fcfa(variante.prix)}</td>
                {estProprietaire && <td>{variante.prix_achat != null ? fcfa(variante.prix_achat) : '—'}</td>}
                {estProprietaire && <td>{variante.marge != null ? fcfa(variante.marge) : '—'}</td>}
                <td>
                  <span className={variante.sous_seuil ? 'etiquette etiquette--alerte' : 'etiquette'}>
                    {variante.quantite}
                  </span>
                </td>
                <td>{variante.seuil_alerte}</td>
                <td>{variante.actif ? 'En vente' : 'Retirée'}</td>
                {!lectureSeule && (
                  <td>
                    <div className="rangee" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="bouton bouton--discret bouton--petit"
                        onClick={() => onEditer(variante)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="bouton bouton--danger bouton--petit"
                        onClick={() => setARetirer(variante)}
                      >
                        Retirer
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="champ__aide" style={{ marginTop: 10 }}>
        Le stock ne se modifie pas ici : il passe par un mouvement, dans <Link to="/admin/stock">Stock</Link>.
      </p>

      {aRetirer && (
        <Modale
          titre={`Retirer « ${aRetirer.libelle} » ?`}
          onFermer={() => setARetirer(null)}
          actions={
            <>
              <button type="button" className="bouton bouton--discret" onClick={() => setARetirer(null)}>
                Annuler
              </button>
              <button type="button" className="bouton bouton--danger" onClick={retirer}>
                Retirer
              </button>
            </>
          }
        >
          <p>
            Si cette variante a déjà bougé, elle est désactivée et son historique reste consultable.
          </p>
        </Modale>
      )}
    </div>
  )
}

/* --- Création / modification d'une variante -------------------------- */
function ModaleVariante({ produitId, variante, onFermer, onEnregistre }) {
  const creation = variante.id === undefined
  const toasts = useToasts()
  const [valeurs, setValeurs] = useState({
    libelle: variante.libelle ?? '',
    sku: variante.sku ?? '',
    prix: variante.prix != null ? String(variante.prix) : '',
    prix_achat: variante.prix_achat != null ? String(variante.prix_achat) : '',
    seuil_alerte: variante.seuil_alerte != null ? String(variante.seuil_alerte) : '3',
    quantite: '',
    actif: variante.actif ?? true,
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
      const commun = {
        libelle: valeurs.libelle,
        prix: Number(valeurs.prix),
        seuil_alerte: Number(valeurs.seuil_alerte || 0),
        actif: valeurs.actif,
        ...(valeurs.prix_achat !== '' ? { prix_achat: Number(valeurs.prix_achat) } : {}),
        ...(valeurs.sku !== '' ? { sku: valeurs.sku } : {}),
      }
      if (creation) {
        await api.post(`/admin/produits/${produitId}/variantes`, {
          ...commun,
          quantite: valeurs.quantite === '' ? 0 : Number(valeurs.quantite),
        })
        toasts.succes('Variante ajoutée.')
      } else {
        await api.put(`/admin/variantes/${variante.id}`, commun)
        toasts.succes('Variante enregistrée.')
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
    <Modale titre={creation ? 'Ajouter une variante' : `Modifier « ${variante.libelle} »`} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <Message ton="erreur">{erreur}</Message>
        <Champ
          libelle="Libellé"
          value={valeurs.libelle}
          erreur={champs.libelle}
          onChange={(evenement) => setValeurs({ ...valeurs, libelle: evenement.target.value })}
          placeholder="Bois foncé, 100 ml…"
          required
        />
        <div className="ligne-champs">
          <Champ
            libelle="Prix de vente"
            type="number"
            inputMode="numeric"
            min="0"
            value={valeurs.prix}
            erreur={champs.prix}
            onChange={(evenement) => setValeurs({ ...valeurs, prix: evenement.target.value })}
            required
          />
          <Champ
            libelle="Prix d'achat"
            type="number"
            inputMode="numeric"
            min="0"
            value={valeurs.prix_achat}
            erreur={champs.prix_achat}
            onChange={(evenement) => setValeurs({ ...valeurs, prix_achat: evenement.target.value })}
          />
          <Champ
            libelle="Seuil d'alerte"
            type="number"
            inputMode="numeric"
            min="0"
            value={valeurs.seuil_alerte}
            erreur={champs.seuil_alerte}
            onChange={(evenement) => setValeurs({ ...valeurs, seuil_alerte: evenement.target.value })}
          />
          {creation && (
            <Champ
              libelle="Quantité initiale"
              type="number"
              inputMode="numeric"
              min="0"
              value={valeurs.quantite}
              erreur={champs.quantite}
              onChange={(evenement) => setValeurs({ ...valeurs, quantite: evenement.target.value })}
              aide="Entre en stock comme un arrivage."
            />
          )}
        </div>
        <Champ
          libelle="SKU"
          value={valeurs.sku}
          erreur={champs.sku}
          onChange={(evenement) => setValeurs({ ...valeurs, sku: evenement.target.value })}
          aide={creation ? 'Laissez vide pour le générer automatiquement.' : undefined}
        />
        <label className="rangee" style={{ gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={valeurs.actif}
            onChange={(evenement) => setValeurs({ ...valeurs, actif: evenement.target.checked })}
            style={{ width: 20, minHeight: 20 }}
          />
          <span>Variante en vente</span>
        </label>
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

/* --- Photos ---------------------------------------------------------- */
function Photos({ produit, lectureSeule, onRafraichir }) {
  const toasts = useToasts()
  const champFichiers = useRef(null)
  const [varianteCible, setVarianteCible] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function televerser(evenement) {
    const fichiers = Array.from(evenement.target.files ?? [])
    if (fichiers.length === 0) return

    const formData = new FormData()
    fichiers.forEach((fichier) => formData.append('images[]', fichier))
    if (varianteCible) formData.append('variante_id', varianteCible)

    setEnvoi(true)
    try {
      await api.televerser(`/admin/produits/${produit.id}/images`, formData)
      toasts.succes(`${fichiers.length} photo(s) ajoutée(s).`)
      onRafraichir()
    } catch (probleme) {
      toasts.erreur(
        probleme instanceof ErreurApi
          ? probleme.champs?.images ?? probleme.message
          : 'Envoi impossible.',
      )
    } finally {
      setEnvoi(false)
      if (champFichiers.current) champFichiers.current.value = ''
    }
  }

  async function rattacher(image, varianteId) {
    try {
      await api.put(`/admin/images/${image.id}`, { variante_id: varianteId === '' ? null : Number(varianteId) })
      onRafraichir()
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Modification impossible.')
    }
  }

  async function supprimer(image) {
    try {
      await api.supprimer(`/admin/images/${image.id}`)
      toasts.succes('Photo supprimée.')
      onRafraichir()
    } catch (probleme) {
      toasts.erreur(probleme instanceof ErreurApi ? probleme.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="carte">
      <div className="carte__titre">
        <h2>Photos</h2>
      </div>

      {!lectureSeule && (
        <div className="rangee" style={{ marginBottom: 14 }}>
          <label className="champ" style={{ margin: 0, flex: '1 1 220px' }}>
            <span className="champ__libelle">Rattacher les photos à</span>
            <select value={varianteCible} onChange={(evenement) => setVarianteCible(evenement.target.value)}>
              <option value="">Le produit (toutes variantes)</option>
              {produit.variantes.map((variante) => (
                <option key={variante.id} value={variante.id}>
                  {variante.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="champ" style={{ margin: 0, flex: '1 1 220px' }}>
            <span className="champ__libelle">Ajouter des photos</span>
            <input
              ref={champFichiers}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={televerser}
              disabled={envoi}
            />
            <span className="champ__aide">
              Redimensionnées à 1200 px et compressées automatiquement.
            </span>
          </label>
        </div>
      )}

      {produit.images.length === 0 ? (
        <p className="texte-gris texte-petit">Aucune photo pour l'instant.</p>
      ) : (
        <div className="galerie">
          {produit.images.map((image) => (
            <figure className="galerie__vignette" key={image.id} style={{ margin: 0 }}>
              <img src={image.url} alt="" loading="lazy" />
              {!lectureSeule && (
                <div className="galerie__actions">
                  <select
                    value={image.variante_id ?? ''}
                    onChange={(evenement) => rattacher(image, evenement.target.value)}
                    aria-label="Variante associée à la photo"
                    style={{ flex: 1 }}
                  >
                    <option value="">Produit</option>
                    {produit.variantes.map((variante) => (
                      <option key={variante.id} value={variante.id}>
                        {variante.libelle}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="bouton bouton--danger bouton--petit"
                    onClick={() => supprimer(image)}
                    aria-label="Supprimer la photo"
                  >
                    ✕
                  </button>
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
