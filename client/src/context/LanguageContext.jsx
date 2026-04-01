import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext(null)

const STORAGE_KEY = '3l-languages'

export function LanguageProvider({ children }) {
  const [nativeLanguage, setNativeLanguage] = useState(null)
  const [targetLanguage, setTargetLanguage] = useState(null)

  // Carregar do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { native, target } = JSON.parse(saved)
      setNativeLanguage(native)
      setTargetLanguage(target)
    }
  }, [])

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
