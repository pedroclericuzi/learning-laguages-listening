import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '..', 'cache')
const CACHE_FILE = join(CACHE_DIR, 'translations.json')

// ── Cache persistente em arquivo ──────────────────────────────
let cache = {}

function loadCache() {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    if (existsSync(CACHE_FILE)) {
      cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
    }
  } catch {
    cache = {}
  }
}

function saveCache() {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
  } catch (e) {
    console.error('Translation cache save error:', e.message)
  }
}

loadCache()

// ── Tradução via Google Translate (endpoint gratuito) ─────────
async function translateChunk(text, from, to) {
  const cacheKey = `${from}:${to}:${text}`
  if (cache[cacheKey]) return cache[cacheKey]

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Translation HTTP ${res.status}`)

    const data = await res.json()
    // Resposta: [[["tradução","original",null,null,x],...],...]
    const translated = data[0]
      .filter((item) => item[0])
      .map((item) => item[0])
      .join('')

    cache[cacheKey] = translated
    saveCache()
    return translated
  } catch (e) {
    console.error('Translation error:', e.message)
    return text
  }
}

// ── Detectar idioma de uma letra ──────────────────────────────
export async function detectLanguage(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 200))}`
    const res = await fetch(url)
    const data = await res.json()
    // O idioma detectado vem no índice [2]
    return data[2] || 'en'
  } catch {
    return 'en'
  }
}

// ── Traduzir array de linhas de letras ────────────────────────
export async function translateLyrics(lines, fromLang, toLang) {
  if (fromLang === toLang) {
    return lines.map((line) => ({ ...line, translation: line.text }))
  }

  // Juntar todas as linhas em um bloco com separador
  // para fazer UMA chamada de API (muito mais rápido)
  const separator = '\n'
  const textsToTranslate = lines.map((l) => l.text || '')

  // Dividir em chunks de ~1500 chars para evitar limit de URL
  const chunks = []
  let currentChunk = []
  let currentLength = 0

  for (const text of textsToTranslate) {
    if (currentLength + text.length > 1500 && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentLength = 0
    }
    currentChunk.push(text)
    currentLength += text.length + 1
  }
  if (currentChunk.length > 0) chunks.push(currentChunk)

  // Traduzir cada chunk
  const allTranslated = []
  for (const chunk of chunks) {
    const joined = chunk.join(separator)
    const translated = await translateChunk(joined, fromLang, toLang)
    const translatedLines = translated.split(separator)

    // Alinhar traduções com originais
    for (let i = 0; i < chunk.length; i++) {
      allTranslated.push(translatedLines[i]?.trim() || '')
    }
  }

  // Montar resultado final
  return lines.map((line, i) => ({
    ...line,
    translation: allTranslated[i] || '',
  }))
}
