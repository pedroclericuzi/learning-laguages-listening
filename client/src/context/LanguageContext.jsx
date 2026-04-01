import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext(null)

const STORAGE_KEY = '3l-languages'

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return { native: null, target: null }
}

export function LanguageProvider({ children }) {
  const saved = loadSaved()
  const [nativeLanguage, setNativeLanguage] = useState(saved.native)
  const [targetLanguage, setTargetLanguage] = useState(saved.target)

  // Salvar no localStorage
  useEffect(() => {
    if (nativeLanguage && targetLanguage) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ native: nativeLanguage, target: targetLanguage })
      )
    }
  }, [nativeLanguage, targetLanguage])

  function reset() {
    localStorage.removeItem(STORAGE_KEY)
    setNativeLanguage(null)
    setTargetLanguage(null)
  }

  return (
    <LanguageContext.Provider
      value={{
        nativeLanguage,
        targetLanguage,
        setNativeLanguage,
        setTargetLanguage,
        reset,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
