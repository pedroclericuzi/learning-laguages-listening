import { useState, useEffect } from 'react'
import { useFavorites } from '../../context/FavoritesContext'
import SongCard from '../../components/SongCard'
import './Favorites.css'

export default function Favorites() {
  const { favoriteIds } = useFavorites()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (favoriteIds.length === 0) {
      setSongs([])
      setLoading(false)
      return
    }
    setLoading(true)
    // Buscar cada música do Deezer pelos IDs favoritos
    Promise.all(
      favoriteIds.map((id) =>
        fetch(`/api/songs/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((results) => setSongs(results.filter(Boolean)))
      .finally(() => setLoading(false))
  }, [favoriteIds])

  return (
    <div className="favorites">
      <h1 className="favorites__title">❤️ Favoritos</h1>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando...</p>
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
