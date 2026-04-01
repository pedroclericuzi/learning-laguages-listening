import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiPlay,
  FiPause,
  FiSkipBack,
  FiSkipForward,
  FiRepeat,
  FiGlobe,
  FiBookOpen,
  FiEdit3,
  FiCheckCircle,
  FiVolume2,
} from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import { useToast } from '../../components/Toast'
import ErrorState from '../../components/ErrorState'
import { ClickableText, WordPopup } from '../../components/WordTranslation'
import './StoryPlayer.css'

export default function StoryPlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { targetLanguage, nativeLanguage } = useLanguage()

  const audioRef = useRef(null)
  const linesRef = useRef(null)
  const toast = useToast()

  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [audioLoading, setAudioLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showTranslation, setShowTranslation] = useState(true)
  const [repeatIndex, setRepeatIndex] = useState(null)
  const [speed, setSpeed] = useState(1)

  // Quiz state: { [lineIndex]: { answered: bool, correct: bool, selected: string } }
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizMode, setQuizMode] = useState(true)
  const [quizPaused, setQuizPaused] = useState(false) // Pausa automática para quiz
  const wasPlayingRef = useRef(false) // Se estava tocando antes da pausa do quiz
  const pauseCooldownRef = useRef(0) // Timestamp até quando ignorar pausas

  // Buscar conteúdo com timestamps + tradução
  function loadContent() {
    setLoading(true)
    setError(null)
    setQuizAnswers({})
    setQuizPaused(false)
    wasPlayingRef.current = false
    fetch(`/api/stories/${id}/content?lang=${targetLanguage}&translate=${nativeLanguage}`)
      .then((r) => {
        if (!r.ok) throw new Error('Conto não encontrado')
        return r.json()
      })
      .then(setContent)
      .catch((e) => {
        setError(e.message)
        toast.error('Falha ao carregar o conto. Verifique sua conexão.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadContent()
  }, [id, targetLanguage, nativeLanguage])

  const lines = content?.lines || []

  // Encontrar a próxima frase com quiz não respondido (para pausar antes dela)
  const pendingQuizEndTimes = useRef([])
  useEffect(() => {
    if (!quizMode || !lines.length) {
      pendingQuizEndTimes.current = []
      return
    }
    pendingQuizEndTimes.current = lines
      .map((l, i) => ({ index: i, end: l.end, hasBlank: !!l.blank }))
      .filter((item) => item.hasBlank && !quizAnswers[item.index]?.answered)
  }, [lines, quizMode, quizAnswers])

  // Atualizar frase ativa baseada no tempo
  useEffect(() => {
    if (!lines.length) return
    // Se pausado para quiz, não avançar o activeIndex
    if (quizPaused) return

    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].start && currentTime < lines[i].end) {
        idx = i
        break
      }
    }
    // Se nenhuma frase encontrada mas áudio rodando, verificar se passou da última
    if (idx === -1 && currentTime > 0 && lines.length > 0) {
      // Se está entre frases, manter a anterior
      for (let i = lines.length - 1; i >= 0; i--) {
        if (currentTime >= lines[i].start) {
          idx = i
          break
        }
      }
    }
    if (idx !== activeIndex) {
      setActiveIndex(idx)
    }
  }, [currentTime, lines, activeIndex, quizPaused])

  // Auto-scroll para frase ativa
  useEffect(() => {
    if (activeIndex >= 0 && linesRef.current) {
      const activeLine = linesRef.current.children[activeIndex]
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeIndex])

  // Pausar áudio no final da frase para o quiz
  useEffect(() => {
    if (!quizMode || !audioRef.current || !lines.length || quizPaused) return

    // Ignorar durante cooldown (após replay/resume)
    if (Date.now() < pauseCooldownRef.current) return

    // Verificar se currentTime atingiu o end de alguma frase pendente de quiz
    const pending = pendingQuizEndTimes.current
    for (const item of pending) {
      if (currentTime >= item.end - 0.05 && currentTime <= item.end + 0.5) {
        audioRef.current.pause()
        audioRef.current.currentTime = item.end
        wasPlayingRef.current = true
        setIsPlaying(false)
        setQuizPaused(true)
        setActiveIndex(item.index)
        break
      }
    }
  }, [currentTime, lines, quizMode, quizPaused])

  // Repetição de frase
  useEffect(() => {
    if (repeatIndex !== null && lines[repeatIndex]) {
      const line = lines[repeatIndex]
      if (currentTime >= line.end) {
        audioRef.current.currentTime = line.start
      }
    }
  }, [currentTime, repeatIndex, lines])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  // Polling mais frequente para detecção precisa da pausa do quiz
  useEffect(() => {
    if (!quizMode || !isPlaying) return
    let rafId
    function tick() {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [quizMode, isPlaying])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setAudioLoading(false)
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
    if (!audioRef.current || !lines.length) return
    // Pular para próxima frase
    const nextIdx = Math.min(activeIndex + 1, lines.length - 1)
    audioRef.current.currentTime = lines[nextIdx]?.start || currentTime + 3
  }

  function skipBackward() {
    if (!audioRef.current || !lines.length) return
    // Voltar para frase anterior
    const prevIdx = Math.max(activeIndex - 1, 0)
    audioRef.current.currentTime = lines[prevIdx]?.start || Math.max(currentTime - 3, 0)
  }

  function handleLineClick(index) {
    if (!audioRef.current || !lines[index]) return
    if (repeatIndex === index) {
      setRepeatIndex(null)
    } else {
      setRepeatIndex(index)
      audioRef.current.currentTime = lines[index].start
      if (!isPlaying) {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  function replayLine(e, index) {
    e.stopPropagation()
    if (!audioRef.current || !lines[index]) return
    // Cooldown de 500ms para evitar que o effect de pausa dispare imediatamente
    pauseCooldownRef.current = Date.now() + 500
    setQuizPaused(false)
    wasPlayingRef.current = true
    audioRef.current.currentTime = lines[index].start
    audioRef.current.play()
    setIsPlaying(true)
  }

  function cycleSpeed() {
    const speeds = [0.5, 0.75, 1, 1.25]
    const currentIdx = speeds.indexOf(speed)
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length]
    setSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleQuizAnswer(lineIndex, selected) {
    if (quizAnswers[lineIndex]?.answered) return // Já respondeu

    const blank = lines[lineIndex]?.blank
    if (!blank) return

    const correct = selected === blank.answer
    setQuizAnswers((prev) => ({
      ...prev,
      [lineIndex]: { answered: true, correct, selected },
    }))

    // Retomar áudio após responder (com pequeno delay para ver o feedback)
    if (quizPaused && audioRef.current) {
      setTimeout(() => {
        pauseCooldownRef.current = Date.now() + 500
        setQuizPaused(false)
        if (wasPlayingRef.current) {
          audioRef.current.play()
          setIsPlaying(true)
          wasPlayingRef.current = false
        }
      }, 800)
    }
  }

  // Score do quiz
  const quizTotal = lines.filter((l) => l.blank).length
  const quizAnswered = Object.keys(quizAnswers).length
  const quizCorrect = Object.values(quizAnswers).filter((a) => a.correct).length

  if (loading) {
    return (
      <div className="story-player__loading">
        <div className="story-player__spinner" />
        <p>Preparando o conto...</p>
        <p className="story-player__loading-hint">
          Gerando áudio e tradução (pode levar alguns segundos na primeira vez)
        </p>
      </div>
    )
  }
  if (error) return (
    <div className="story-player">
      <button className="story-player__back" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Voltar
      </button>
      <ErrorState message={error} onRetry={loadContent} icon="📖" />
    </div>
  )
  if (!content) return null

  const progress = duration ? (currentTime / duration) * 100 : 0
  const sentenceProgress = lines.length
    ? Math.round(((activeIndex + 1) / lines.length) * 100)
    : 0

  return (
    <div className="story-player">
      <button className="story-player__back" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Voltar
      </button>

      <audio
        ref={audioRef}
        src={`/api/stories/${id}/audio?lang=${targetLanguage}`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onCanPlay={() => setAudioLoading(false)}
        onError={() => toast.error('Falha ao carregar o áudio do conto')}
        preload="auto"
      />

      {/* Cabeçalho do conto */}
      <div className="story-player__card">
        <div className="story-player__emoji">{content.lines?.[0] ? '📖' : '📕'}</div>
        <h1 className="story-player__title">{content.title}</h1>
        {content.titleTranslated && content.titleTranslated !== content.title && (
          <p className="story-player__title-translated">{content.titleTranslated}</p>
        )}
        <p className="story-player__author">{content.author}</p>

        <div className="story-player__meta">
          <span className="story-player__badge">
            {content.language?.toUpperCase()}
          </span>
          <span className="story-player__badge story-player__badge--synced">
            Sincronizado
          </span>
          <span className="story-player__badge">
            {lines.length} frases
          </span>
        </div>

        {/* Progresso de leitura */}
        <div className="story-player__reading-progress">
          <div className="story-player__reading-bar">
            <div
              className="story-player__reading-fill"
              style={{ width: `${sentenceProgress}%` }}
            />
          </div>
          <span className="story-player__reading-text">
            {activeIndex >= 0 ? activeIndex + 1 : 0}/{lines.length} frases
          </span>
        </div>

        {/* Barra de progresso do áudio */}
        <div className="story-player__progress-wrapper">
          <div className="story-player__progress" onClick={seekTo}>
            <div
              className="story-player__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="story-player__time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controles */}
        <div className="story-player__controls">
          <button
            className="story-player__ctrl-btn"
            onClick={cycleSpeed}
            title={`Velocidade: ${speed}x`}
          >
            {speed}x
          </button>
          <button className="story-player__ctrl-btn" onClick={skipBackward}>
            <FiSkipBack />
          </button>
          <button
            className="story-player__play-btn"
            onClick={togglePlay}
            disabled={audioLoading}
          >
            {audioLoading ? (
              <div className="story-player__mini-spinner" />
            ) : isPlaying ? (
              <FiPause />
            ) : (
              <FiPlay />
            )}
          </button>
          <button className="story-player__ctrl-btn" onClick={skipForward}>
            <FiSkipForward />
          </button>
          <button
            className="story-player__ctrl-btn"
            onClick={() => setRepeatIndex(null)}
            style={{ color: repeatIndex !== null ? 'var(--color-accent)' : undefined }}
            title={repeatIndex !== null ? 'Parar repetição' : 'Clique numa frase para repetir'}
          >
            <FiRepeat />
          </button>
        </div>
      </div>

      {/* Seção de texto */}
      <div className="story-player__text-section">
        <div className="story-player__text-header">
          <h2 className="story-player__text-title">
            <FiBookOpen /> Texto
          </h2>
          <div className="story-player__text-actions">
            <button
              className={`story-player__toggle ${quizMode ? 'story-player__toggle--active' : ''}`}
              onClick={() => {
                const newMode = !quizMode
                setQuizMode(newMode)
                // Se desligou o quiz enquanto pausado, retomar áudio
                if (!newMode && quizPaused && audioRef.current) {
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
            <button
              className={`story-player__toggle ${showTranslation ? 'story-player__toggle--active' : ''}`}
              onClick={() => setShowTranslation(!showTranslation)}
            >
              <FiGlobe />
              {showTranslation ? 'Tradução ON' : 'Tradução OFF'}
            </button>
          </div>
        </div>

        {/* Score do quiz */}
        {quizMode && quizAnswered > 0 && (
          <div className="story-player__quiz-score">
            <FiCheckCircle />
            <span>{quizCorrect}/{quizAnswered} corretas</span>
            {quizAnswered === quizTotal && (
              <span className="story-player__quiz-final">
                — {Math.round((quizCorrect / quizTotal) * 100)}% de acerto!
              </span>
            )}
          </div>
        )}

        <div className="story-player__lines" ref={linesRef}>
          {lines.map((line, index) => {
            const isActive = index === activeIndex
            const isPast = activeIndex >= 0 && index < activeIndex
            const isRepeating = repeatIndex === index
            const blank = line.blank
            const quiz = quizAnswers[index]
            const showBlank = quizMode && blank && !quiz?.answered
            const showResult = quizMode && blank && quiz?.answered
            const isWaiting = isActive && quizPaused && showBlank

            return (
              <div
                key={index}
                className={`story-player__line ${isActive ? 'story-player__line--active' : ''} ${isPast ? 'story-player__line--past' : ''} ${isRepeating ? 'story-player__line--repeating' : ''} ${isWaiting ? 'story-player__line--waiting' : ''}`}
              >
                <span className="story-player__line-number">{index + 1}</span>
                <button
                  className={`story-player__replay-btn ${isPlaying && !quizPaused ? 'story-player__replay-btn--disabled' : ''}`}
                  onClick={(e) => replayLine(e, index)}
                  disabled={isPlaying && !quizPaused}
                  title="Ouvir novamente"
                >
                  <FiVolume2 size={14} />
                </button>
                <div className="story-player__line-content">
                  <p className="story-player__line-text">
                    <ClickableText
                      text={showBlank ? blank.blankedText : line.text}
                      lang={targetLanguage}
                      nativeLang={nativeLanguage}
                      context={line.text}
                    />
                    {showResult && (
                      <span className={`story-player__quiz-inline ${quiz.correct ? 'story-player__quiz-inline--correct' : 'story-player__quiz-inline--wrong'}`}>
                        {quiz.correct ? ' ✓' : ` ✗ → ${blank.answer}`}
                      </span>
                    )}
                  </p>

                  {/* Quiz options */}
                  {showBlank && (
                    <div className="story-player__quiz-options">
                      {blank.options.map((option) => (
                        <button
                          key={option}
                          className="story-player__quiz-btn"
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

                  {/* Resultado do quiz inline */}
                  {showResult && (
                    <div className={`story-player__quiz-result ${quiz.correct ? 'story-player__quiz-result--correct' : 'story-player__quiz-result--wrong'}`}>
                      {quiz.correct
                        ? '✓ Correto!'
                        : `✗ Você escolheu "${quiz.selected}" — resposta: "${blank.answer}"`}
                    </div>
                  )}

                  {showTranslation && line.translation && (
                    <p className="story-player__line-translation">
                      {line.translation}
                    </p>
                  )}
                  {isRepeating && (
                    <span className="story-player__repeat-badge">
                      <FiRepeat size={10} /> Repetindo
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <WordPopup />
    </div>
  )
}
