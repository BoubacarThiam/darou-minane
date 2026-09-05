import { useEffect, useRef } from 'react'

/** Fenêtre de confirmation. Échap ferme, le fond cliquable ferme. */
export function Modale({ titre, onFermer, children, actions }) {
  const boite = useRef(null)

  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', surTouche)
    boite.current?.querySelector('input, button, select, textarea')?.focus()
    return () => document.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div
      className="modale-fond"
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer()
      }}
    >
      <div className="modale" role="dialog" aria-modal="true" aria-label={titre} ref={boite}>
        <h2 className="modale__titre">{titre}</h2>
        {children}
        {actions ? <div className="modale__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
