import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '..', 'cache')
const WORD_CACHE_FILE = join(CACHE_DIR, 'word_translations.json')

const router = Router()

// ── Cache de traduções de palavras ────────────────────────────
let wordCache = {}

function loadWordCache() {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    if (existsSync(WORD_CACHE_FILE)) {
      wordCache = JSON.parse(readFileSync(WORD_CACHE_FILE, 'utf-8'))
    }
  } catch {
    wordCache = {}
  }
}

function saveWordCache() {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(WORD_CACHE_FILE, JSON.stringify(wordCache, null, 2))
  } catch (e) {
    console.error('Word cache save error:', e.message)
  }
}

loadWordCache()

// ── POST /api/translate/word ──────────────────────────────────
// Body: { word: string, from: string, to: string, context?: string }
// Retorna: { word, translation, from, to }
router.post('/word', async (req, res) => {
  const { word, from, to, context } = req.body

  if (!word || !from || !to) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: word, from, to' })
  }

  const cacheKey = `${from}:${to}:${word.toLowerCase()}`
  if (wordCache[cacheKey]) {
    return res.json({
      word,
      translation: wordCache[cacheKey],
      from,
      to,
    })
  }

  try {
    // ── Tradução contextual: traduzir a frase inteira para obter
    // a tradução da palavra no contexto correto (polissemia) ───
    let contextualTranslation = null
    if (context && context.trim() !== word.trim()) {
      try {
        // Marcar a palavra-alvo na frase com delimitadores
        // para encontrá-la na tradução
        const contextUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(context)}`
        const ctxRes = await fetch(contextUrl)
        if (ctxRes.ok) {
          const ctxData = await ctxRes.json()
          // Extrair mapeamento palavra→tradução dos segmentos
          // data[0] contém pares [tradução, original]
          const segments = ctxData[0] || []
          for (const seg of segments) {
            const original = (seg[1] || '').trim()
            const translated = (seg[0] || '').trim()
            // Se o segmento original contém a palavra que buscamos
            if (original && translated &&
                original.toLowerCase().includes(word.toLowerCase()) &&
                original.toLowerCase() !== context.toLowerCase()) {
              contextualTranslation = translated
              break
            }
          }
        }
      } catch {
        // Fallback silencioso para tradução direta
      }
    }

    // ── Tradução direta da palavra (sempre, para definições) ──
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&dt=bd&q=${encodeURIComponent(word)}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()

    // data[0] = traduções principais [[tradução, original], ...]
    // data[1] = definições por classe gramatical (se disponível)
    const directTranslation = data[0]?.[0]?.[0] || word

    // Usar tradução contextual se disponível e diferente da direta
    const mainTranslation = contextualTranslation || directTranslation

    // Extrair definições por classe gramatical (substantivo, verbo, etc)
    let definitions = null
    if (data[1]) {
      definitions = data[1].map((entry) => ({
        partOfSpeech: entry[0], // "noun", "verb", etc
        meanings: entry[1]?.slice(0, 3) || [], // até 3 significados
      })).filter((d) => d.meanings.length > 0)
    }

    // Cache só da tradução principal
    wordCache[cacheKey] = mainTranslation
    saveWordCache()

    res.json({
      word,
      translation: mainTranslation,
      definitions: definitions || [],
      from,
      to,
    })
  } catch (e) {
    console.error('Word translation error:', e.message)
    res.status(500).json({ error: 'Falha na tradução', details: e.message })
  }
})

export default router
