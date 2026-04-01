import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import SongCard from '../../components/SongCard'
import StoryCard from '../../components/StoryCard'
import './Home.css'

const languageLabels = {
  en: { flag: '🇺🇸', name: 'Inglês' },
  es: { flag: '🇪🇸', name: 'Espanhol' },
  fr: { flag: '🇫🇷', name: 'Francês' },
  pt: { flag: '🇧🇷', name: 'Português' },
  de: { flag: '🇩🇪', name: 'Alemão' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  ja: { flag: '🇯🇵', name: 'Japonês' },
  ko: { flag: '🇰🇷', name: 'Coreano' },
}

export default function Home() {
  const navigate = useNavigate()
  const { targetLanguage } = useLanguage()
  const [popular, setPopular] = useState([])
  const [langSongs, setLangSongs] = useState([])
  const [stories, setStories] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Carregar populares + músicas do idioma alvo + contos
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/songs/popular?limit=8').then((r) => r.json()),
      fetch(`/api/songs/language/${targetLanguage}`).then((r) => r.json()),
      fetch(`/api/stories?lang=${targetLanguage}`).then((r) => r.json()),
    ])
      .then(([popularData, langData, storiesData]) => {
        setPopular(popularData)
        setLangSongs(langData)
        setStories(storiesData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [targetLanguage])

  // Busca com debounce
  const doSearch = useCallback(async (term) => {
    if (!term.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      setSearchResults(data)
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search, doSearch])

  const langInfo = languageLabels[targetLanguage] || { flag: '🌍', name: targetLanguage }

  return (
    <div className="home">
      <div className="home__hero">
        <p className="home__greeting">Bem-vindo ao</p>
        <h1 className="home__title">
          <span className="home__title-accent">3L</span> — Aprenda com Músicas
        </h1>
        <div className="home__search">
          <span className="home__search-icon">
            <FiSearch />
          </span>
          <input
            className="home__search-input"
            type="text"
            placeholder="Buscar música, artista ou álbum..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Resultados de busca */}
      {searchResults !== null ? (
        <section className="home__section">
          <div className="home__section-header">
            <h2 className="home__section-title">
              🔎 Resultados para "{search}"
            </h2>
          </div>
          <div className="home__songs-grid">
            {searching ? (
              <div className="home__empty">Buscando...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((song) => (
                <SongCard key={song.id} song={song} />
              ))
            ) : (
              <div className="home__empty">Nenhuma música encontrada</div>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Contos de Fadas */}
          <section className="home__section">
            <div className="home__section-header">
              <h2 className="home__section-title">
                📖 Contos de Fadas
              </h2>
              <span
                className="home__section-link"
                onClick={() => navigate('/stories')}
              >
                Ver todos →
              </span>
            </div>
            <div className="home__songs-grid">
              {loading ? (
                <div className="home__empty">Carregando...</div>
              ) : stories.length > 0 ? (
                stories.slice(0, 4).map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))
              ) : (
                <div className="home__empty">Nenhum conto encontrado</div>
              )}
            </div>
          </section>

          {/* Músicas no idioma alvo */}
          <section className="home__section">
            <div className="home__section-header">
              <h2 className="home__section-title">
                {langInfo.flag} Músicas em {langInfo.name}
              </h2>
              <span
                className="home__section-link"
                onClick={() => navigate(`/songs?lang=${targetLanguage}`)}
              >
                Ver mais →
              </span>
            </div>
            <div className="home__songs-grid">
              {loading ? (
                <div className="home__empty">Carregando...</div>
              ) : langSongs.length > 0 ? (
                langSongs.slice(0, 5).map((song) => (
                  <SongCard key={song.id} song={song} />
                ))
              ) : (
                <div className="home__empty">Nenhuma música encontrada</div>
              )}
            </div>
          </section>

          {/* Populares globais */}
          <section className="home__section">
            <div className="home__section-header">
              <h2 className="home__section-title">🔥 Populares no mundo</h2>
              <span
                className="home__section-link"
                onClick={() => navigate('/songs')}
              >
                Ver todas →
              </span>
            </div>
            <div className="home__songs-grid">
              {loading ? (
                <div className="home__empty">Carregando...</div>
              ) : popular.length > 0 ? (
                popular.map((song) => (
                  <SongCard key={song.id} song={song} />
                ))
              ) : (
                <div className="home__empty">Nenhuma música encontrada</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
