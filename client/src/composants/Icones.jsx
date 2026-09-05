/* Icônes de navigation — SVG en ligne, aucun téléchargement supplémentaire. */
const commun = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

export const IconeVente = (props) => (
  <svg {...commun} {...props}>
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" />
    <circle cx="10" cy="20" r="1.2" />
    <circle cx="18" cy="20" r="1.2" />
  </svg>
)

export const IconeProduits = (props) => (
  <svg {...commun} {...props}>
    <path d="M12 3 4 7v10l8 4 8-4V7z" />
    <path d="M4 7l8 4 8-4M12 11v10" />
  </svg>
)

export const IconeStock = (props) => (
  <svg {...commun} {...props}>
    <path d="M4 8h16v12H4z" />
    <path d="M2 4h20v4H2zM10 12h4" />
  </svg>
)

export const IconeCompte = (props) => (
  <svg {...commun} {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
)

export const IconeRecherche = (props) => (
  <svg {...commun} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
)
