import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const SpotifyContext = createContext(null)

const STORAGE_KEY = '3l-spotify-token'

export function SpotifyProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  // Validar token e buscar dados do usuário
  const fetchUser = useCallback(async (accessToken) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/spotify/me?token=${accessToken}`)
      if (!res.ok) {
        // Token inválido/expirado — limpar
        localStorage.removeItem(STORAGE_KEY)
        setToken(null)
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data)
    } catch {
      console.warn('Não conseguiu validar o token Spotify')
    } finally {
      setLoading(false)
    }
  }, [])

  // Validar token ao montar
  useEffect(() => {
    if (token) fetchUser(token)
  }, [token, fetchUser])

  // Salvar token (chamado após callback OAuth)
  function connect(accessToken) {
    localStorage.setItem(STORAGE_KEY, accessToken)
    setToken(accessToken)
    fetchUser(accessToken)
  }

  function disconnect() {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  // Iniciar fluxo OAuth
  function startAuth() {
    window.location.href = '/api/auth/spotify'
  }

  const value = {
    token,
    user,
    loading,
    isConnected: !!token && !!user,
    isPremium: !!user?.isPremium,
    connect,
    disconnect,
    startAuth,
  }

  return (
    <SpotifyContext.Provider value={value}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (!context) throw new Error('useSpotify deve ser usado dentro de SpotifyProvider')
  return context
}
