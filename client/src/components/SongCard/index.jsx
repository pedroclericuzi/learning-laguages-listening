import { useNavigate } from 'react-router-dom'
import { FiHeart } from 'react-icons/fi'
import { useFavorites } from '../../context/FavoritesContext'
import './SongCard.css'

function formatDuration(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SongCard({ song }) {
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const fav = isFavorite(song.id)

  return (
    <div className="song-card" onClick={() => navigate(`/player/${song.id}`)}>
      <img
        className="song-card__cover"
        src={song.cover}
        alt={song.title}
        onError={(e) => {
          e.target.src = `https://placehold.co/56x56/1a1a2e/6C63FF?text=${song.title?.[0] || '?'}`
        }}
      />
      <div className="song-card__info">
        <div className="song-card__title">{song.title}</div>
        <div className="song-card__artist">{song.artist}</div>
        <div className="song-card__meta">
          {song.duration && (
            <span className="song-card__badge song-card__badge--beginner">
              {formatDuration(song.duration)}
            </span>
          )}
          {song.album && (
            <span className="song-card__badge song-card__badge--intermediate">
              {song.album}
            </span>
          )}
        </div>
      </div>
      <button
        className={`song-card__fav ${fav ? 'song-card__fav--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(song.id)
        }}
        title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <FiHeart fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
