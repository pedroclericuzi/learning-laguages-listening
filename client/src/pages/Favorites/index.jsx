import { useState, useEffect } from 'react'
import { useFavorites } from '../../context/FavoritesContext'
import { useToast } from '../../components/Toast'
import SongCard from '../../components/SongCard'
import ErrorState from '../../components/ErrorState'
import './Favorites.css'

export default function Favorites() {
  const { favoriteIds } = useFavorites()
  const toast = useToast()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function loadFavorites() {
    if (favoriteIds.length === 0) {
      setSongs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all(
      favoriteIds.map((id) =>
        fetch(`/api/songs/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((results) => {
        const valid = results.filter(Boolean)
        const failed = results.length - valid.length
        setSongs(valid)
        if (failed > 0) {
          toast.warning(`${failed} música(s) não puderam ser carregadas`)
        }
      })
      .catch((e) => {
        setError('Falha ao carregar favoritos')
        toast.error('Erro ao carregar músicas favoritas')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFavorites()
  }, [favoriteIds])

  return (
    <div className="favorites">
      <h1 className="favorites__title">❤️ Favoritos</h1>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
      ) : error ? (
        <ErrorState message={error} onRetry={loadFavorites} icon="❤️" />
      ) : songs.length > 0 ? (
        <div className="favorites__grid">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div className="favorites__empty">
          <div className="favorites__empty-icon">💜</div>
          <p className="favorites__empty-text">Nenhuma música favorita ainda</p>
          <p className="favorites__empty-hint">
            Toque no ❤️ em qualquer música para salvá-la aqui
          </p>
        </div>
      )}
    </div>
  )
}
