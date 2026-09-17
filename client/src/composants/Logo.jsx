/**
 * Le sceau officiel de Darou Minane, celui de l'icône d'application.
 * Fichiers générés par outils/generer-icones.py : 128 px suffit jusqu'à
 * 3x pour un logo de 40 px, le 256 sert au grand logo de la connexion.
 */
export function Logo({ taille, className, alt = '' }) {
  return (
    <img
      className={className}
      src="/icones/logo-128.webp"
      srcSet="/icones/logo-128.webp 128w, /icones/logo-256.webp 256w"
      sizes={`${taille}px`}
      width={taille}
      height={taille}
      alt={alt}
      decoding="async"
    />
  )
}
