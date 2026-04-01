import { useState, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import './WordTranslation.css'

// ── Referência direta ao setter do popup (evita eventos/re-renders) ───
let _setWordPopup = null

// ── Helpers para detectar scripts CJK ──────────────────────────────────
const CJK_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/
const WORD_CHAR_REGEX = /[a-zA-ZÀ-ÿ'\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/

function isCJK(text) {
  return CJK_REGEX.test(text)
}

/**
 * Tokeniza texto em palavras clicáveis.
 * - Latinas: split por espaços
 * - CJK (ja/ko/zh): Intl.Segmenter(word) ou fallback por caractere
 */
function tokenize(text, lang) {
  if (!text) return []

  // Se contém CJK, usar Intl.Segmenter se disponível
  if (isCJK(text)) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(lang, { granularity: 'word' })
        return [...segmenter.segment(text)].map((seg) => ({
          text: seg.segment,
          isWord: seg.isWordLike === true,
        }))
      } catch {
        // fallback abaixo
      }
    }
    // Fallback: agrupar caracteres CJK contíguos, separar pontuação/espaços
    const tokens = []
    const regex = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+|[a-zA-ZÀ-ÿ']+|[^\s]|\s+)/g
    let m
    while ((m = regex.exec(text)) !== null) {
      const t = m[0]
      tokens.push({
        text: t,
        isWord: WORD_CHAR_REGEX.test(t) && t.trim().length > 0,
      })
    }
    return tokens
  }

  // Idiomas com espaços (latinas)
  return text.split(/(\s+)/).filter(Boolean).map((t) => {
    if (/^\s+$/.test(t)) return { text: t, isWord: false }
    const clean = t.replace(/[^a-zA-ZÀ-ÿ'-]/g, '')
    return { text: t, isWord: /[a-zA-ZÀ-ÿ]/.test(t) && clean.length >= 2 }
  })
}

/**
 * Limpa uma palavra para tradução, preservando CJK.
 */
function cleanWord(word) {
  if (isCJK(word)) {
    // Remover apenas pontuação genérica, manter CJK + latinas
    return word.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g, '')
  }
  return word.replace(/[^a-zA-ZÀ-ÿ'-]/g, '')
}

// ── Componente de palavra clicável ─────────────────────────────────────
export const ClickableText = memo(function ClickableText({ text, lang, nativeLang, context }) {

  function handleWordClick(e, word) {
    e.stopPropagation()
    e.preventDefault()

    const clean = cleanWord(word)
    if (!clean || clean.length < 1) return
    // Para latinas, exigir pelo menos 2 chars; para CJK, 1 é ok
    if (!isCJK(clean) && clean.length < 2) return
    if (!_setWordPopup) return

    const rect = e.currentTarget.getBoundingClientRect()
    let top = rect.bottom + 8
    let left = rect.left + rect.width / 2
    if (top + 160 > window.innerHeight) top = rect.top - 160
    left = Math.max(150, Math.min(left, window.innerWidth - 150))

    // Mostrar popup IMEDIATAMENTE com loading
    _setWordPopup({
      word: clean,
      translation: null,
      definitions: [],
      top,
      left,
    })

    // Buscar tradução em background
    fetch('/api/translate/word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: clean, from: lang, to: nativeLang, context }),
    })
      .then((res) => res.json())
      .then((data) => {
        _setWordPopup?.((prev) => {
          if (!prev || prev.word !== clean) return prev
          return {
            ...prev,
            translation: data.translation,
            definitions: data.definitions || [],
          }
        })
      })
      .catch(() => {
        _setWordPopup?.((prev) => {
          if (!prev || prev.word !== clean) return prev
          return { ...prev, translation: '(erro)' }
        })
      })
  }

  const tokens = tokenize(text, lang)

  return (
    <span className="clickable-text">
      {tokens.map((token, i) => {
        if (!token.isWord) return <span key={i}>{token.text}</span>

        return (
          <span
            key={i}
            className="clickable-text__word"
            onClick={(e) => handleWordClick(e, token.text)}
          >
            {token.text}
          </span>
        )
      })}
    </span>
  )
})

// ── Popup de tradução (independente do ciclo de re-render) ─────────────
export function WordPopup() {
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
