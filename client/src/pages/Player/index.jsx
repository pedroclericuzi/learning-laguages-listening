import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiPlay,
  FiPause,
  FiSkipBack,
  FiSkipForward,
  FiRepeat,
  FiHeart,
  FiGlobe,
  FiX,
} from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import { useFavorites } from '../../context/FavoritesContext'
import './Player.css'

// ── Referência direta ao setter do popup (evita eventos/re-renders) ───
let _setWordPopup = null

// ── Componente de palavra clicável ─────────────────────────────────────
const ClickableText = memo(function ClickableText({ text, lang, nativeLang, context }) {

  function handleWordClick(e, word) {
    e.stopPropagation()
    e.preventDefault()

    const cleanWord = word.replace(/[^a-zA-ZÀ-ÿ'-]/g, '')
    if (!cleanWord || cleanWord.length < 2) return
    if (!_setWordPopup) return

    const rect = e.currentTarget.getBoundingClientRect()
    let top = rect.bottom + 8
    let left = rect.left + rect.width / 2
    if (top + 160 > window.innerHeight) top = rect.top - 160
    left = Math.max(150, Math.min(left, window.innerWidth - 150))

    // Mostrar popup IMEDIATAMENTE com loading
    _setWordPopup({
      word: cleanWord,
      translation: null,
      definitions: [],
      top,
      left,
    })

    // Buscar tradução em background
    fetch('/api/translate/word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: cleanWord, from: lang, to: nativeLang, context }),
    })
      .then((res) => res.json())
      .then((data) => {
        _setWordPopup?.((prev) => {
          if (!prev || prev.word !== cleanWord) return prev
          return {
            ...prev,
            translation: data.translation,
            definitions: data.definitions || [],
          }
        })
      })
      .catch(() => {
        _setWordPopup?.((prev) => {
          if (!prev || prev.word !== cleanWord) return prev
          return { ...prev, translation: '(erro)' }
        })
      })
  }

  const tokens = text.split(/(\s+)/).filter(Boolean)

  return (
    <span className="player__clickable-text">
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>

        const cleanToken = token.replace(/[^a-zA-ZÀ-ÿ'-]/g, '')
        if (!/[a-zA-ZÀ-ÿ]/.test(token) || cleanToken.length < 2) {
          return <span key={i}>{token}</span>
        }

        return (
          <span
            key={i}
            className="player__word"
            onClick={(e) => handleWordClick(e, token)}
          >
            {token}
          </span>
        )
      })}
    </span>
  )
})

// ── Popup de tradução (independente do ciclo de re-render dos versos) ───
function WordPopup() {
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    _setWordPopup = setPopup
    return () => { _setWordPopup = null }
  }, [])

  if (!popup) return null

  const isLoading = popup.translation === null

  return createPortal(
    <>
      <div className="word-popup-overlay" onClick={() => setPopup(null)} />
      <div
        className="word-popup"
        style={{ top: popup.top, left: popup.left }}
      >
        <button className="word-popup__close" onClick={() => setPopup(null)}>
          <FiX size={12} />
        </button>
        <div className="word-popup__original">{popup.word}</div>
        {isLoading ? (
          <div className="word-popup__translation" style={{ opacity: 0.5 }}>Traduzindo...</div>
        ) : (
          <>
            <div className="word-popup__translation">{popup.translation}</div>
            {popup.definitions?.length > 0 && (
              <div className="word-popup__defs">
                {popup.definitions.slice(0, 2).map((def, i) => (
                  <div key={i} className="word-popup__def">
                    <span className="word-popup__pos">{def.partOfSpeech}</span>
                    <span>{def.meanings.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>,
    document.body
  )
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { nativeLanguage } = useLanguage()
  const { isFavorite, toggleFavorite } = useFavorites()

  const audioRef = useRef(null)
  const lyricsRef = useRef(null)

  const [song, setSong] = useState(null)
  const [lyricsData, setLyricsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lyricsLoading, setLyricsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1)
  const [showTranslation, setShowTranslation] = useState(true)
  const [repeatIndex, setRepeatIndex] = useState(null)

  // 1. Buscar dados da música (Deezer)
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/songs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Música não encontrada')
        return r.json()
      })
      .then(setSong)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // 2. Buscar letras + tradução (LRCLIB + Google Translate)
  useEffect(() => {
    if (!song) return
    setLyricsLoading(true)
    fetch(`/api/songs/${id}/lyrics?translate=${nativeLanguage}`)
      .then((r) => r.json())
      .then(setLyricsData)
      .catch((e) => console.error('Lyrics error:', e))
      .finally(() => setLyricsLoading(false))
  }, [id, song, nativeLanguage])

  const lyrics = lyricsData?.lines || []
  const isSynced = lyricsData?.synced || false

  // Atualizar lyric ativo baseado no tempo (apenas se synced)
  useEffect(() => {
    if (!isSynced || !lyrics.length) return
    const index = lyrics.findIndex(
      (l) => currentTime >= l.start && currentTime < l.end
    )
    if (index !== activeLyricIndex) {
      setActiveLyricIndex(index)
    }
  }, [currentTime, lyrics, isSynced, activeLyricIndex])

  // Auto-scroll para lyric ativo
  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricsRef.current) {
      const activeLine = lyricsRef.current.children[activeLyricIndex]
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeLyricIndex])

  // Repetir trecho (apenas synced)
  useEffect(() => {
    if (repeatIndex !== null && isSynced && lyrics[repeatIndex]) {
      const lyric = lyrics[repeatIndex]
      if (currentTime >= lyric.end) {
        audioRef.current.currentTime = lyric.start
      }
    }
  }, [currentTime, repeatIndex, lyrics, isSynced])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  function togglePlay() {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function seekTo(e) {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
  }

  function skipForward() {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(currentTime + 5, duration)
    }
  }

  function skipBackward() {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(currentTime - 5, 0)
    }
  }

  function handleLyricClick(index) {
    if (!isSynced || !audioRef.current || !lyrics[index]) return
    if (repeatIndex === index) {
      setRepeatIndex(null)
    } else {
      setRepeatIndex(index)
      audioRef.current.currentTime = lyrics[index].start
      if (!isPlaying) {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) return <div className="player__loading">Carregando música...</div>
  if (error) return <div className="player__error">{error}</div>
  if (!song) return null

  const fav = isFavorite(song.id)
  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="player">
      <button className="player__back" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Voltar
      </button>

      <audio
        ref={audioRef}
        src={song.preview}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* Card do player */}
      <div className="player__card">
        <img
          className="player__cover"
          src={song.coverBig || song.cover}
          alt={song.title}
          onError={(e) => {
            e.target.src = `https://placehold.co/200x200/1a1a2e/6C63FF?text=${song.title?.[0] || '?'}`
          }}
        />
        <h1 className="player__song-title">{song.title}</h1>
        <p className="player__artist">{song.artist}</p>
        {song.album && (
          <p className="player__album">{song.album}</p>
        )}

        <div className="player__meta">
          <span className="player__badge">Preview 30s</span>
          {lyricsData?.language && (
            <span className="player__badge">{lyricsData.language.toUpperCase()}</span>
          )}
          {isSynced && <span className="player__badge player__badge--synced">Sincronizado</span>}
        </div>

        {/* Barra de progresso */}
        <div className="player__progress-wrapper">
          <div className="player__progress" onClick={seekTo}>
            <div
              className="player__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="player__time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controles */}
        <div className="player__controls">
          <button
            className={`player__ctrl-btn player__fav-btn ${fav ? 'player__fav-btn--active' : ''}`}
            onClick={() => toggleFavorite(song.id)}
          >
            <FiHeart fill={fav ? 'currentColor' : 'none'} />
          </button>
          <button className="player__ctrl-btn" onClick={skipBackward}>
            <FiSkipBack />
          </button>
          <button className="player__play-btn" onClick={togglePlay}>
            {isPlaying ? <FiPause /> : <FiPlay />}
          </button>
          <button className="player__ctrl-btn" onClick={skipForward}>
            <FiSkipForward />
          </button>
          {isSynced && (
            <button
              className="player__ctrl-btn"
              onClick={() => setRepeatIndex(null)}
              style={{ color: repeatIndex !== null ? 'var(--color-accent)' : undefined }}
              title={repeatIndex !== null ? 'Parar repetição' : 'Toque em um verso para repetir'}
            >
              <FiRepeat />
            </button>
          )}
        </div>

        {!song.preview && (
          <p className="player__no-preview">
            Preview de áudio indisponível para esta música
          </p>
        )}
      </div>

      {/* Seção de letras */}
      <div className="player__lyrics-section">
        <div className="player__lyrics-header">
          <h2 className="player__lyrics-title">📝 Letra</h2>
          <button
            className={`player__translation-toggle ${showTranslation ? 'player__translation-toggle--active' : ''}`}
            onClick={() => setShowTranslation(!showTranslation)}
          >
            <FiGlobe />
            {showTranslation ? 'Tradução ON' : 'Tradução OFF'}
          </button>
        </div>

        {lyricsLoading ? (
          <div className="player__lyrics-loading">
            <div className="player__spinner" />
            Buscando letras e tradução...
          </div>
        ) : lyrics.length > 0 ? (
          <div className="player__lyrics-list" ref={lyricsRef}>
            {lyrics.map((lyric, index) => {
              const isActive = isSynced && index === activeLyricIndex
              const isPast =
                isSynced && activeLyricIndex >= 0 && index < activeLyricIndex
              const isRepeating = repeatIndex === index

              return (
                <div
                  key={index}
                  className={`player__lyric-line ${isActive ? 'player__lyric-line--active' : ''} ${isPast ? 'player__lyric-line--past' : ''} ${isSynced ? 'player__lyric-line--clickable' : ''}`}
                  onClick={() => handleLyricClick(index)}
                >
                  <p className="player__lyric-text">
                    <ClickableText
                      text={lyric.text}
                      lang={lyricsData?.language || 'en'}
                      nativeLang={nativeLanguage}
                      context={lyric.text}
                    />
                  </p>
                  {showTranslation && lyric.translation && (
                    <p className="player__lyric-translation">
                      {lyric.translation}
                    </p>
                  )}
                  {isRepeating && (
                    <span className="player__repeat-badge">
                      <FiRepeat size={10} /> Repetindo
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="player__no-lyrics">
            <p>😔 Letras não encontradas para esta música</p>
            <p className="player__no-lyrics-hint">
              Tente outra música — letras de artistas populares tem mais chances de estarem disponíveis.
            </p>
          </div>
        )}
      </div>

      <WordPopup />
    </div>
  )
}
