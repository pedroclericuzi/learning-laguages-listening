import { useState, useEffect, useRef, useCallback } from 'react'
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
  FiEdit3,
  FiCheckCircle,
  FiVolume2,
} from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import { useFavorites } from '../../context/FavoritesContext'
import { useReport } from '../../context/ReportContext'
import { useToast } from '../../components/Toast'
import ErrorState from '../../components/ErrorState'
import { ClickableText, WordPopup } from '../../components/WordTranslation'
import './Player.css'

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { nativeLanguage } = useLanguage()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { saveSongResult } = useReport()

  const audioRef = useRef(null)
  const lyricsRef = useRef(null)
  const toast = useToast()

  // 'spotify' = embed iframe (padrão), 'preview' = 30s com sync de letras (apenas quando preview_url disponível)
  const [playerMode, setPlayerMode] = useState('spotify')
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

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizMode, setQuizMode] = useState(true)
  const [quizPaused, setQuizPaused] = useState(false)
  const wasPlayingRef = useRef(false)
  const pauseCooldownRef = useRef(0)
  const pendingQuizEndTimes = useRef([])

  // Refs para salvar no unmount
  const quizAnswersRef = useRef({})
  const quizTotalRef = useRef(0)
  const songTitleRef = useRef('')

  // Spotify iFrame API
  const embedDivRef = useRef(null)
  const embedControllerRef = useRef(null)
  const isMountedRef = useRef(true)
  useEffect(() => () => { isMountedRef.current = false }, [])

  // 1. Buscar dados da música (Spotify)
  function loadSong() {
    setLoading(true)
    setError(null)
    fetch(`/api/songs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Música não encontrada')
        return r.json()
      })
      .then((data) => {
        setSong(data)
        songTitleRef.current = data?.title || ''
      })
      .catch((e) => {
        setError(e.message)
        toast.error('Falha ao carregar música. Verifique sua conexão.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSong()
  }, [id])

  // Salvar resultado do quiz ao sair
  useEffect(() => {
    return () => {
      const answers = quizAnswersRef.current
      const answered = Object.keys(answers).length
      const correct = Object.values(answers).filter((a) => a.correct).length
      if (answered > 0) {
        saveSongResult(id, songTitleRef.current || id, correct, answered)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spotify iFrame API ─────────────────────────────────────────────────────
  // Inicializa o EmbedController e escuta playbackUpdate para obter currentTime
  function initEmbedController(api) {
    if (!embedDivRef.current || !song) return
    // Destruir controller anterior se existir
    embedControllerRef.current = null
    api.createController(
      embedDivRef.current,
      { uri: `spotify:track:${song.id}` },
      (controller) => {
        embedControllerRef.current = controller
        controller.addListener('playbackUpdate', ({ data }) => {
          if (!data || !isMountedRef.current) return
          setCurrentTime(data.position / 1000)   // ms → s
          setDuration(data.duration / 1000)
          setIsPlaying(!data.isPaused)
        })
      }
    )
  }

  useEffect(() => {
    if (playerMode !== 'spotify' || !song) return
    // Se o controller já existe, apenas muda a faixa
    if (embedControllerRef.current) {
      embedControllerRef.current.loadUri(`spotify:track:${song.id}`)
      return
    }
    // Se a API já foi carregada anteriormente
    if (window._spotifyIframeApi) {
      initEmbedController(window._spotifyIframeApi)
      return
    }
    // Configura callback para quando a API carregar
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window._spotifyIframeApi = IFrameAPI
      if (isMountedRef.current) initEmbedController(IFrameAPI)
    }
    // Injeta o script uma única vez
    if (!document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) {
      const script = document.createElement('script')
      script.src = 'https://open.spotify.com/embed/iframe-api/v1'
      script.async = true
      document.head.appendChild(script)
    }
  }, [song, playerMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Invalida controller quando sai do modo Spotify
  useEffect(() => {
    if (playerMode !== 'spotify') embedControllerRef.current = null
  }, [playerMode])

  // 2. Buscar letras + tradução (LRCLIB + Google Translate)
  useEffect(() => {
    if (!song) return
    setLyricsLoading(true)
    fetch(`/api/songs/${id}/lyrics?translate=${nativeLanguage}`)
      .then((r) => {
        if (!r.ok) throw new Error('Letras não encontradas')
        return r.json()
      })
      .then((data) => {
        setLyricsData(data)
        const total = (data?.lines || []).filter((l) => l.blank).length
        quizTotalRef.current = total
        setQuizAnswers({})
      })
      .catch(() => {
        toast.warning('Não foi possível carregar as letras desta música')
      })
      .finally(() => setLyricsLoading(false))
  }, [id, song, nativeLanguage])

  const lyrics = lyricsData?.lines || []
  const isSynced = lyricsData?.synced || false

  // Atualizar lyric ativo baseado no tempo (apenas se synced)
  useEffect(() => {
    if (!isSynced || !lyrics.length) return
    if (quizPaused) return // manter highlight durante quiz
    const index = lyrics.findIndex(
      (l) => currentTime >= l.start && currentTime < l.end
    )
    if (index !== activeLyricIndex) {
      setActiveLyricIndex(index)
    }
  }, [currentTime, lyrics, isSynced, activeLyricIndex, quizPaused])

  // Auto-scroll para lyric ativo
  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricsRef.current) {
      const activeLine = lyricsRef.current.children[activeLyricIndex]
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeLyricIndex])

  // Repetir trecho
  useEffect(() => {
    if (repeatIndex === null || !isSynced || !lyrics[repeatIndex]) return
    const lyric = lyrics[repeatIndex]
    if (currentTime >= lyric.end) {
      if (playerMode === 'preview' && audioRef.current) {
        audioRef.current.currentTime = lyric.start
      } else if (playerMode === 'spotify' && embedControllerRef.current) {
        embedControllerRef.current.seek(lyric.start * 1000)
      }
    }
  }, [currentTime, repeatIndex, lyrics, isSynced, playerMode])

  // Manter ref sincronizado para save-on-unmount
  useEffect(() => { quizAnswersRef.current = quizAnswers }, [quizAnswers])

  // Lista de linhas pendentes de quiz (para deterção de pausa)
  useEffect(() => {
    if (!quizMode || !lyrics.length || !isSynced) {
      pendingQuizEndTimes.current = []
      return
    }
    pendingQuizEndTimes.current = lyrics
      .map((l, i) => ({ index: i, end: l.end, hasBlank: !!l.blank }))
      .filter((item) => item.hasBlank && !quizAnswers[item.index]?.answered)
  }, [lyrics, quizMode, quizAnswers, isSynced])

  // Pausar no final da frase para o quiz (ambos os modos)
  useEffect(() => {
    if (!quizMode || !lyrics.length || quizPaused) return
    if (Date.now() < pauseCooldownRef.current) return

    const pending = pendingQuizEndTimes.current
    for (const item of pending) {
      if (currentTime >= item.end - 0.05 && currentTime <= item.end + 0.5) {
        if (playerMode === 'preview' && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = item.end
          setIsPlaying(false)
        } else if (playerMode === 'spotify' && embedControllerRef.current) {
          embedControllerRef.current.pause()
        }
        wasPlayingRef.current = true
        setQuizPaused(true)
        setActiveLyricIndex(item.index)
        break
      }
    }
  }, [currentTime, lyrics, quizMode, quizPaused, playerMode])

  // RAF polling preciso apenas no modo preview (Spotify usa playbackUpdate)
  useEffect(() => {
    if (!quizMode || !isPlaying || playerMode !== 'preview') return
    let rafId
    function tick() {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [quizMode, isPlaying, playerMode])

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
    if (!isSynced || !lyrics[index]) return
    if (repeatIndex === index) {
      setRepeatIndex(null)
    } else {
      setRepeatIndex(index)
      if (playerMode === 'preview' && audioRef.current) {
        audioRef.current.currentTime = lyrics[index].start
        if (!isPlaying) { audioRef.current.play(); setIsPlaying(true) }
      } else if (playerMode === 'spotify' && embedControllerRef.current) {
        embedControllerRef.current.seek(lyrics[index].start * 1000)
      }
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleQuizAnswer(lineIndex, selected) {
    if (quizAnswers[lineIndex]?.answered) return
    const blank = lyrics[lineIndex]?.blank
    if (!blank) return

    const correct = selected === blank.answer
    setQuizAnswers((prev) => ({
      ...prev,
      [lineIndex]: { answered: true, correct, selected },
    }))

    if (quizPaused) {
      setTimeout(() => {
        pauseCooldownRef.current = Date.now() + 500
        setQuizPaused(false)
        if (wasPlayingRef.current) {
          if (playerMode === 'preview' && audioRef.current) {
            audioRef.current.play()
            setIsPlaying(true)
          } else if (playerMode === 'spotify' && embedControllerRef.current) {
            embedControllerRef.current.resume()
          }
          wasPlayingRef.current = false
        }
      }, 800)
    }
  }

  function replayLyric(e, index) {
    e.stopPropagation()
    if (!lyrics[index]) return
    pauseCooldownRef.current = Date.now() + 500
    setQuizPaused(false)
    wasPlayingRef.current = true
    if (playerMode === 'preview' && audioRef.current) {
      audioRef.current.currentTime = lyrics[index].start
      audioRef.current.play()
      setIsPlaying(true)
    } else if (playerMode === 'spotify' && embedControllerRef.current) {
      embedControllerRef.current.seek(lyrics[index].start * 1000)
      embedControllerRef.current.resume()
    }
  }

  const quizTotal = lyrics.filter((l) => l.blank).length
  const quizAnswered = Object.keys(quizAnswers).length
  const quizCorrect = Object.values(quizAnswers).filter((a) => a.correct).length

  if (loading) return <div className="player__loading">Carregando música...</div>
  if (error) return (
    <div className="player">
      <button className="player__back" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Voltar
      </button>
      <ErrorState message={error} onRetry={loadSong} icon="🎵" />
    </div>
  )
  if (!song) return null

  const fav = isFavorite(song.id)
  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="player">
      <button className="player__back" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Voltar
      </button>

      {/* Seletor de modo: só aparece se a música tem preview_url (raro desde 2024) */}
      {song?.preview && (
        <div className="player__mode-toggle">
          <button
            className={`player__mode-btn ${playerMode === 'spotify' ? 'player__mode-btn--active' : ''}`}
            onClick={() => setPlayerMode('spotify')}
          >
            🎵 Spotify Player
          </button>
          <button
            className={`player__mode-btn ${playerMode === 'preview' ? 'player__mode-btn--active' : ''}`}
            onClick={() => setPlayerMode('preview')}
          >
            🔁 Preview sincronizado
          </button>
        </div>
      )}

      {playerMode === 'preview' ? (
        /* ── Player 30s Preview (com sync de letras) ── */
        <>
          <audio
            ref={audioRef}
            src={song.preview}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onError={() => toast.error('Áudio indisponível para esta música')}
            crossOrigin="anonymous"
          />

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
        </>
      ) : (
        /* ── Player Spotify Premium (embed completo) ── */
        <div className="player__card">
          <img
            className="player__cover"
            src={song.coverBig || song.cover}
            alt={song.title}
            onError={(e) => {
              e.target.src = `https://placehold.co/200x200/1a1a2e/1DB954?text=${song.title?.[0] || '?'}`
            }}
          />
          <h1 className="player__song-title">{song.title}</h1>
          <p className="player__artist">{song.artist}</p>
          {song.album && (
            <p className="player__album">{song.album}</p>
          )}

          <div className="player__meta">
            <span className="player__badge player__badge--premium">🎵 Spotify</span>
            {lyricsData?.language && (
              <span className="player__badge">{lyricsData.language.toUpperCase()}</span>
            )}
          </div>

          <div className="player__spotify-widget">
            <div ref={embedDivRef} className="player__spotify-embed" />
          </div>

          <p className="player__spotify-hint">
            30s grátis · Música completa com Spotify Premium. Faça login no widget se necessário.
          </p>

          <div className="player__controls">
            <button
              className={`player__ctrl-btn player__fav-btn ${fav ? 'player__fav-btn--active' : ''}`}
              onClick={() => toggleFavorite(song.id)}
            >
              <FiHeart fill={fav ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      )}

      {/* Seção de letras */}
      <div className="player__lyrics-section">
        <div className="player__lyrics-header">
          <h2 className="player__lyrics-title">📝 Letra</h2>
          <div className="player__lyrics-actions">
            {isSynced && (
              <button
                className={`player__translation-toggle ${quizMode ? 'player__translation-toggle--active' : ''}`}
                onClick={() => {
                  const next = !quizMode
                  setQuizMode(next)
                  if (!next && quizPaused && audioRef.current) {
                    setQuizPaused(false)
                    if (wasPlayingRef.current) {
                      audioRef.current.play()
                      setIsPlaying(true)
                      wasPlayingRef.current = false
                    }
                  }
                }}
              >
                <FiEdit3 />
                {quizMode ? 'Quiz ON' : 'Quiz OFF'}
              </button>
            )}
            <button
              className={`player__translation-toggle ${showTranslation ? 'player__translation-toggle--active' : ''}`}
              onClick={() => setShowTranslation(!showTranslation)}
            >
              <FiGlobe />
              {showTranslation ? 'Tradução ON' : 'Tradução OFF'}
            </button>
          </div>
        </div>

        {/* Score do quiz */}
        {isSynced && quizMode && quizAnswered > 0 && (
          <div className="player__quiz-score">
            <FiCheckCircle />
            <span>{quizCorrect}/{quizAnswered} corretas</span>
            {quizAnswered === quizTotal && quizTotal > 0 && (
              <span className="player__quiz-final">
                — {Math.round((quizCorrect / quizTotal) * 100)}% de acerto!
              </span>
            )}
          </div>
        )}

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
              const blank = lyric.blank
              const quiz = quizAnswers[index]
              const showBlank = quizMode && isSynced && blank && !quiz?.answered
              const showResult = quizMode && isSynced && blank && quiz?.answered
              const isWaiting = isActive && quizPaused && showBlank

              return (
                <div
                  key={index}
                  className={`player__lyric-line ${isActive ? 'player__lyric-line--active' : ''} ${isPast ? 'player__lyric-line--past' : ''} ${isSynced ? 'player__lyric-line--clickable' : ''} ${isWaiting ? 'player__lyric-line--waiting' : ''}`}
                  onClick={() => handleLyricClick(index)}
                >
                  {isSynced && (
                    <button
                      className="player__replay-btn"
                      onClick={(e) => replayLyric(e, index)}
                      title="Ouvir novamente"
                    >
                      <FiVolume2 size={13} />
                    </button>
                  )}
                  <div className="player__lyric-body">
                    <p className="player__lyric-text">
                      <ClickableText
                        text={showBlank ? blank.blankedText : lyric.text}
                        lang={lyricsData?.language || 'en'}
                        nativeLang={nativeLanguage}
                        context={lyric.text}
                      />
                      {showResult && (
                        <span className={`player__quiz-inline ${quiz.correct ? 'player__quiz-inline--correct' : 'player__quiz-inline--wrong'}`}>
                          {quiz.correct ? ' ✓' : ` ✗ → ${blank.answer}`}
                        </span>
                      )}
                    </p>

                    {showBlank && (
                      <div className="player__quiz-options">
                        {blank.options.map((option) => (
                          <button
                            key={option}
                            className="player__quiz-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuizAnswer(index, option)
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}

                    {showResult && (
                      <div className={`player__quiz-result ${quiz.correct ? 'player__quiz-result--correct' : 'player__quiz-result--wrong'}`}>
                        {quiz.correct
                          ? '✓ Correto!'
                          : `✗ Você escolheu "${quiz.selected}" — resposta: "${blank.answer}"`}
                      </div>
                    )}

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
