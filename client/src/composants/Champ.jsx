import { useId } from 'react'

/**
 * Champ de formulaire étiqueté. Le message d'erreur du serveur est affiché
 * sous le champ et relié à lui par aria-describedby.
 */
export function Champ({ libelle, erreur, aide, children, ...props }) {
  const id = useId()
  const idAide = `${id}-aide`
  const commun = {
    id,
    'aria-invalid': erreur ? 'true' : undefined,
    'aria-describedby': erreur || aide ? idAide : undefined,
    ...props,
  }

  return (
    <label className="champ" htmlFor={id}>
      <span className="champ__libelle">{libelle}</span>
      {children ? children(commun) : <input {...commun} />}
      {erreur ? (
        <span className="champ__erreur" id={idAide}>{erreur}</span>
      ) : aide ? (
        <span className="champ__aide" id={idAide}>{aide}</span>
      ) : null}
    </label>
  )
}
