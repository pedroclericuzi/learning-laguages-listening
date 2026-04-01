import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import { useToast } from '../../components/Toast'
import SongCard from '../../components/SongCard'
import ErrorState from '../../components/ErrorState'
import './SongList.css'

const suggestions = [
  'Ed Sheeran', 'Adele', 'Luis Fonsi', 'Édith Piaf', 'Coldplay',
  'Shakira', 'BTS', 'Anitta', 'Drake', 'The Weeknd',
]

export default function SongList() {
  const [searchParams] = useSearchParams()
  const { targetLanguage } = useLanguage()
  const toast = useToast()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const langParam = searchParams.get('lang')

  const fetchSongs = useCallback(async (query) => {
    setLoading(true)
    setError(null)
    // Usa lang da URL ou idioma alvo do usuário como fallback
    const lang = langParam || targetLanguage
    try {
      let url
      if (query?.trim()) {
        url = `/api/songs/search?q=${encodeURIComponent(query)}&lang=${lang}`
      } else {
        url = `/api/songs/language/${lang}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro ao buscar músicas')
      const data = await res.json()
      setSongs(data)
    } catch (e) {
      setError(e.message)
      toast.error('Falha ao carregar músicas. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }, [langParam, targetLanguage, toast])

  // Busca com debounce
  useEffect(() => {
    const timer = setTimeout(() => fetchSongs(search), 400)
    return () => clearTimeout(timer)
  }, [search, fetchSongs])

  return (
    <div className="song-list">
      <div className="song-list__header">
        <h1 className="song-list__title">🎶 Explorar Músicas</h1>

        <div className="song-list__search">
          <FiSearch className="song-list__search-icon" />
          <input
            className="song-list__search-input"
            type="text"
            placeholder="Buscar música, artista ou álbum..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!search && (
          <div className="song-list__filters">
            {suggestions.map((s) => (
              <button
                key={s}
                className="song-list__filter"
                onClick={() => setSearch(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="song-list__count">
        {loading
          ? 'Buscando...'
          : `${songs.length} música(s) encontrada(s)`}
      </p>

      <div className="song-list__grid">
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => fetchSongs(search)} icon="🎵" />
        ) : !loading && songs.length === 0 ? (
          <div className="song-list__empty">
            Nenhuma música encontrada. Tente outra busca.
          </div>
        ) : (
          songs.map((song) => <SongCard key={song.id} song={song} />)
        )}
      </div>
    </div>
  )
}
