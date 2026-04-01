import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import { useToast } from '../../components/Toast'
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

/** Aviso inline para seções que falharam */
function SectionWarning({ message, onRetry }) {
  return (
    <div className="home__section-warning">
      <FiAlertTriangle className="home__section-warning-icon" />
      <span>{message}</span>
      {onRetry && (
        <button className="home__section-warning-btn" onClick={onRetry}>
          <FiRefreshCw size={14} /> Tentar novamente
        </button>
      )}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { targetLanguage } = useLanguage()
  const toast = useToast()

  // Estado independente por seção
  const [langSongs, setLangSongs] = useState([])
  const [stories, setStories] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)

  const [loadingStories, setLoadingStories] = useState(true)
  const [loadingSongs, setLoadingSongs] = useState(true)
  const [errorStories, setErrorStories] = useState(null)
  const [errorSongs, setErrorSongs] = useState(null)

  // Carregar contos (independente)
  function loadStories() {
    setLoadingStories(true)
    setErrorStories(null)
    fetch(`/api/stories?lang=${targetLanguage}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao carregar contos')
        return r.json()
      })
      .then(setStories)
      .catch((e) => setErrorStories(e.message))
      .finally(() => setLoadingStories(false))
  }

  // Carregar músicas por idioma (independente)
  function loadSongs() {
    setLoadingSongs(true)
    setErrorSongs(null)
    fetch(`/api/songs/language/${targetLanguage}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao buscar músicas')
        return r.json()
      })
      .then(setLangSongs)
      .catch((e) => setErrorSongs(e.message))
      .finally(() => setLoadingSongs(false))
  }

  useEffect(() => {
    loadStories()
    loadSongs()
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
      if (!res.ok) throw new Error('Erro na busca')
      const data = await res.json()
      setSearchResults(data)
    } catch (e) {
      toast.error('Erro ao buscar músicas. Tente novamente.')
      setSearchResults([])
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
              {loadingStories ? (
                <div className="home__empty">Carregando contos...</div>
              ) : errorStories ? (
                <SectionWarning
                  message="Não foi possível carregar os contos."
                  onRetry={loadStories}
                />
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
              {loadingSongs ? (
                <div className="home__empty">Carregando músicas...</div>
              ) : errorSongs ? (
                <SectionWarning
                  message="Não foi possível carregar as músicas."
                  onRetry={loadSongs}
                />
              ) : langSongs.length > 0 ? (
                langSongs.slice(0, 5).map((song) => (
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
