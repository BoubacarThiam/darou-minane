import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ErreurApi } from '../api.js'
import { fcfa } from '../format.js'
import { usePanier } from '../panier.jsx'
import { useBoutique } from '../boutique.jsx'
import { useToasts } from '../composants/Toasts.jsx'
import { AnnonceChargement, EtatVide, SqueletteFiche } from '../composants/Etats.jsx'

export default function Produit() {
  const { slug } = useParams()
  const { ajouter } = usePanier()
  const boutique = useBoutique()
  const toasts = useToasts()

  const [produit, setProduit] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [introuvable, setIntrouvable] = useState(false)
  const [varianteId, setVarianteId] = useState(null)
  const [imageActive, setImageActive] = useState(0)

  useEffect(() => {
    let annule = false
    setChargement(true)
    api
      .get(`/produits/${slug}`)
      .then((fiche) => {
        if (annule) return
        setProduit(fiche)
        // On présélectionne la première variante disponible, pas une rupture.
        const disponible = fiche.variantes.find((variante) => variante.en_stock) ?? fiche.variantes[0]
        setVarianteId(disponible?.id ?? null)
      })
      .catch((probleme) => {
        if (!annule && probleme instanceof ErreurApi && probleme.statut === 404) setIntrouvable(true)
      })
      .finally(() => { if (!annule) setChargement(false) })
    return () => { annule = true }
  }, [slug])

  const variante = useMemo(
    () => produit?.variantes.find((v) => v.id === varianteId) ?? null,
    [produit, varianteId],
  )

  // Choisir une déclinaison amène sa photo si elle en a une.
  useEffect(() => {
    if (!produit || !varianteId) return
    const index = produit.images.findIndex((image) => image.variante_id === varianteId)
    if (index >= 0) setImageActive(index)
  }, [produit, varianteId])

  if (chargement) {
    return (
      <div className="pile-large">
        <AnnonceChargement texte="Chargement de l'article…" />
        <SqueletteFiche />
      </div>
    )
  }
  if (introuvable || !produit) {
    return (
      <EtatVide titre="Article introuvable">
        <p className="texte-petit">
          <Link to="/catalogue">Revenir au catalogue</Link>
        </p>
      </EtatVide>
    )
  }

  const images = produit.images.length > 0 ? produit.images : [null]
  const plusieursVariantes = produit.variantes.length > 1

  function ajouterAuPanier() {
    if (!variante || !variante.en_stock) return
    ajouter({
      variante_id: variante.id,
      produit_slug: produit.slug,
      produit_nom: produit.nom,
      libelle: variante.libelle,
      prix: variante.prix,
      image: produit.images.find((i) => i.variante_id === variante.id)?.url ?? produit.images[0]?.url ?? null,
    })
    toasts.succes(`${produit.nom} ajouté au panier.`)
  }

  return (
    <div className="pile-large">
      <div className="fil-ariane">
        <Link to="/">Accueil</Link>
        <span aria-hidden="true">·</span>
        <Link to={`/c/${produit.categorie.slug}`}>{produit.categorie.nom}</Link>
      </div>

      <div className="fiche">
        <div className="fiche__galerie">
          <div className="fiche__photo">
            {images[imageActive] ? (
              <img
                src={images[imageActive].url}
                srcSet={images[imageActive].srcset ?? undefined}
                sizes="(min-width: 900px) 50vw, 100vw"
                alt={`${produit.nom} — ${variante?.libelle ?? ''}`}
                decoding="async"
              />
            ) : (
              <span className="vignette__absente" aria-hidden="true" />
            )}
          </div>
          {images.length > 1 && (
            <div className="fiche__vignettes">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className={index === imageActive ? 'fiche__vignette fiche__vignette--active' : 'fiche__vignette'}
                  onClick={() => setImageActive(index)}
                  aria-label={`Photo ${index + 1}`}
                >
                  <img
                    src={image.url}
                    srcSet={image.srcset ?? undefined}
                    sizes="72px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fiche__infos">
          <h1>{produit.nom}</h1>
          <p className="fiche__prix">{fcfa(variante ? variante.prix : produit.prix_min)}</p>

          {plusieursVariantes && (
            <div className="fiche__variantes">
              <p className="champ__libelle" id="choix-variante">
                Choisissez votre {produit.categorie.slug === 'parfums' ? 'contenance' : 'modèle'}
              </p>
              <div className="rangee" role="group" aria-labelledby="choix-variante">
                {produit.variantes.map((autre) => (
                  <button
                    key={autre.id}
                    type="button"
                    className={
                      autre.id === varianteId ? 'choix choix--actif' : autre.en_stock ? 'choix' : 'choix choix--rupture'
                    }
                    onClick={() => setVarianteId(autre.id)}
                    aria-pressed={autre.id === varianteId}
                  >
                    {autre.libelle}
                    {!autre.en_stock && <span className="texte-petit"> — épuisé</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {variante && !variante.en_stock ? (
            <>
              <p className="message message--info">
                Cette déclinaison est épuisée. Écrivez-nous : nous vous préviendrons dès son retour.
              </p>
              {boutique.whatsapp && (
                <a
                  className="bouton bouton--discret bouton--grand"
                  href={`https://wa.me/${boutique.whatsapp}?text=${encodeURIComponent(
                    `Bonjour, je cherche ${produit.nom} — ${variante.libelle}. Quand sera-t-il disponible ?`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Demander sur WhatsApp
                </a>
              )}
            </>
          ) : (
            <button type="button" className="bouton bouton--grand bouton--plein" onClick={ajouterAuPanier}>
              Ajouter au panier
            </button>
          )}

          <p className="texte-gris texte-petit">
            Livraison à {boutique.zone_livraison}, frais à convenir. Paiement à la livraison.
          </p>

          {produit.description && <p className="fiche__description">{produit.description}</p>}

          {/* Beaucoup d'articles du catalogue n'ont pas de description : sans ces
              quelques lignes, la colonne se réduit à un prix et un bouton. La
              contenance d'un flacon n'apparaissait nulle part quand le produit
              n'avait qu'une seule déclinaison. */}
          {variante && (
            <dl className="fiche__specs">
              {!plusieursVariantes && (
                <div>
                  <dt>{produit.categorie.slug === 'parfums' ? 'Contenance' : 'Modèle'}</dt>
                  <dd>{variante.libelle}</dd>
                </div>
              )}
              <div>
                <dt>Rayon</dt>
                <dd>
                  <Link to={`/c/${produit.categorie.slug}`}>{produit.categorie.nom}</Link>
                </dd>
              </div>
              <div>
                <dt>Disponibilité</dt>
                <dd>{variante.en_stock ? 'En stock à Tambacounda' : 'Épuisé'}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
