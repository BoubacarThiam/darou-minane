import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fourchettePrix } from '../format.js'

/**
 * Galerie en arc pour la vitrine.
 *
 * Adaptée du CircularGallery de 21st.dev, mais réécrite sans WebGL ni
 * dépendance : l'original passe par OGL, une bibliothèque de rendu 3D qui
 * pèse plus que tout le reste du front réuni et demande un GPU correct.
 * Ici, le défilement est celui du navigateur — tactile, avec inertie,
 * accessible au clavier — et chaque vignette n'est déplacée que par
 * `transform`, la seule propriété fluide sur les téléphones d'entrée de
 * gamme visés par cette boutique.
 *
 * `courbure` correspond au `bend` d'origine : hauteur de l'arc en pixels.
 */
export function GalerieCirculaire({ produits, courbure = 46 }) {
  const piste = useRef(null)
  const image = useRef(0)

  /* Une seule lecture de position par image écran, un seul écrit de
     transform par vignette : pas de calcul de mise en page dans la boucle. */
  const placer = useCallback(() => {
    const element = piste.current
    if (!element) return
    const milieu = element.scrollLeft + element.clientWidth / 2
    for (const vignette of element.children) {
      const centre = vignette.offsetLeft + vignette.offsetWidth / 2
      // −1 à gauche, 0 au centre, +1 à droite.
      const ecart = Math.max(-1, Math.min(1, (centre - milieu) / (element.clientWidth / 2)))
      const descente = Math.abs(ecart) ** 2 * courbure
      const echelle = 1 - Math.abs(ecart) * 0.14
      vignette.style.transform =
        `translate3d(0, ${descente.toFixed(1)}px, 0) scale(${echelle.toFixed(3)})`
      vignette.style.opacity = (1 - Math.abs(ecart) * 0.35).toFixed(3)
      /* L'inclinaison ne porte que sur la photo : un nom de produit et un
         prix penchés se lisent mal, et c'est ce qu'on vient chercher. */
      const photo = vignette.querySelector('.galerie-arc__photo')
      if (photo) photo.style.transform = `rotate(${(ecart * 7).toFixed(2)}deg)`
    }
  }, [courbure])

  useEffect(() => {
    const element = piste.current
    if (!element) return

    // Respect du réglage système : pas d'arc, une rangée simple.
    const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (sansMouvement.matches) return

    const surDefilement = () => {
      if (image.current) return
      image.current = requestAnimationFrame(() => {
        image.current = 0
        placer()
      })
    }

    placer()
    element.addEventListener('scroll', surDefilement, { passive: true })
    window.addEventListener('resize', surDefilement)
    return () => {
      element.removeEventListener('scroll', surDefilement)
      window.removeEventListener('resize', surDefilement)
      if (image.current) cancelAnimationFrame(image.current)
    }
  }, [placer, produits])

  if (!produits || produits.length === 0) return null

  return (
    <div className="galerie-arc">
      <ul className="galerie-arc__piste" ref={piste} aria-label="Sélection de la boutique">
        {produits.map((produit, rang) => (
          <li className="galerie-arc__element" key={produit.id}>
            <Link className="galerie-arc__lien" to={`/p/${produit.slug}`}>
              <span className="galerie-arc__photo">
                {produit.image ? (
                  <img
                    src={produit.image}
                    alt={produit.nom}
                    loading={rang < 3 ? 'eager' : 'lazy'}
                    fetchpriority={rang < 3 ? 'high' : 'auto'}
                    decoding="async"
                  />
                ) : (
                  <span className="vignette__absente" aria-hidden="true" />
                )}
              </span>
              <span className="galerie-arc__nom">{produit.nom}</span>
              <span className="galerie-arc__prix">
                {fourchettePrix(produit.prix_min, produit.prix_max)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="galerie-arc__aide texte-gris texte-petit">
        Faites glisser pour parcourir la sélection.
      </p>
    </div>
  )
}
