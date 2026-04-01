import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import SongCard from '../../components/SongCard'
import './SongList.css'

const suggestions = [
  'Ed Sheeran', 'Adele', 'Luis Fonsi', 'Édith Piaf', 'Coldplay',
  'Shakira', 'BTS', 'Anitta', 'Drake', 'The Weeknd',
]

export default function SongList() {
  const [searchParams] = useSearchParams()
  const { targetLanguage } = useLanguage()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const langParam = searchParams.get('lang')

  const fetchSongs = useCallback(async (query) => {
    setLoading(true)
    try {
      let url
      if (query?.trim()) {
        url = `/api/songs/search?q=${encodeURIComponent(query)}`
      } else if (langParam) {
        url = `/api/songs/language/${langParam}`
      } else {
        url = '/api/songs/popular?limit=30'
      }
      const res = await fetch(url)
      const data = await res.json()
      setSongs(data)
    } catch (e) {
      console.error('Error fetching songs:', e)
    } finally {
      setLoading(false)
    }
  }, [langParam])

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
        {!loading && songs.length === 0 ? (
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
