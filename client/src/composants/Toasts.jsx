import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ContexteToasts = createContext(null)

/** Messages éphémères — confirmation de vente, erreur réseau, etc. */
export function FournisseurToasts({ children }) {
  const [messages, setMessages] = useState([])

  const retirer = useCallback((id) => {
    setMessages((actuels) => actuels.filter((message) => message.id !== id))
  }, [])

  const afficher = useCallback(
    (texte, ton = 'info', duree = 4000) => {
      const id = Math.random().toString(36).slice(2)
      setMessages((actuels) => [...actuels, { id, texte, ton }])
      window.setTimeout(() => retirer(id), duree)
    },
    [retirer],
  )

  const valeur = useMemo(
    () => ({
      afficher,
      succes: (texte) => afficher(texte, 'succes'),
      erreur: (texte) => afficher(texte, 'erreur', 6000),
    }),
    [afficher],
  )

  return (
    <ContexteToasts.Provider value={valeur}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {messages.map((message) => (
          <div key={message.id} className={`toast toast--${message.ton}`} role="status">
            {message.texte}
          </div>
        ))}
      </div>
    </ContexteToasts.Provider>
  )
}

export function useToasts() {
  const contexte = useContext(ContexteToasts)
  if (!contexte) throw new Error('useToasts doit être utilisé dans FournisseurToasts.')
  return contexte
}
