/**
 * Serviço de Text-to-Speech usando edge-tts (Microsoft Edge Neural TTS)
 * Gera áudio MP3 + legendas VTT com timestamps por palavra.
 * Cache em disco: arquivos são gerados uma vez e reutilizados.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '..', 'cache', 'tts')

// Criar diretório de cache
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })

// ── Vozes por idioma (vozes neurais masculinas, tom de contador de histórias) ──
const VOICES = {
  en: 'en-US-GuyNeural',
  pt: 'pt-BR-AntonioNeural',
  es: 'es-ES-AlvaroNeural',
  fr: 'fr-FR-HenriNeural',
  de: 'de-DE-ConradNeural',
  it: 'it-IT-DiegoNeural',
  ja: 'ja-JP-KeitaNeural',
  ko: 'ko-KR-InJoonNeural',
}

// ── Gerar áudio para um texto ─────────────────────────────────
export async function generateAudio(storyId, text, langCode) {
  const voice = VOICES[langCode] || VOICES.en
  const audioPath = join(CACHE_DIR, `${storyId}_${langCode}.mp3`)
  const vttPath = join(CACHE_DIR, `${storyId}_${langCode}.vtt`)
  const timestampsPath = join(CACHE_DIR, `${storyId}_${langCode}.json`)
  const textPath = join(CACHE_DIR, `${storyId}_${langCode}_input.txt`)

  // Se já existe em cache, retornar paths
  if (existsSync(audioPath) && existsSync(timestampsPath)) {
    return {
      audioPath,
      timestamps: JSON.parse(readFileSync(timestampsPath, 'utf-8')),
    }
  }

  // Escrever texto em arquivo para evitar problemas com aspas/caracteres especiais
  writeFileSync(textPath, text, 'utf-8')

  console.log(`🎙️ Gerando TTS: ${storyId} [${langCode}] com voz ${voice}`)

  try {
    // Chamar edge-tts via Python usando --file
    await execFileAsync('python3', [
      '-m', 'edge_tts',
      '--file', textPath,
      '--voice', voice,
      '--rate=-5%',
      '--write-media', audioPath,
      '--write-subtitles', vttPath,
    ], { timeout: 120000 })

    // Parsear VTT para extrair timestamps
    const timestamps = parseVTT(vttPath)

    // Salvar timestamps em JSON para cache rápido
    writeFileSync(timestampsPath, JSON.stringify(timestamps, null, 2))

    // Remover arquivos temporários
    if (existsSync(vttPath)) unlinkSync(vttPath)
    if (existsSync(textPath)) unlinkSync(textPath)

    console.log(`✅ TTS gerado: ${audioPath} (${timestamps.length} segmentos)`)

    return { audioPath, timestamps }
  } catch (error) {
    if (existsSync(textPath)) unlinkSync(textPath)
    console.error(`❌ Erro TTS ${storyId}[${langCode}]:`, error.message)
    throw new Error(`Falha ao gerar áudio: ${error.message}`)
  }
}

// ── Gerar áudio para um array de sentenças ────────────────────
// Junta sentenças com pausa e mapeia timestamps de volta
export async function generateStoryAudio(storyId, sentences, langCode) {
  const voice = VOICES[langCode] || VOICES.en
  const audioPath = join(CACHE_DIR, `${storyId}_${langCode}.mp3`)
  const vttPath = join(CACHE_DIR, `${storyId}_${langCode}.vtt`)
  const mappingPath = join(CACHE_DIR, `${storyId}_${langCode}_sentences.json`)
  const textPath = join(CACHE_DIR, `${storyId}_${langCode}_input.txt`)

  // Se já existe em cache, retornar
  if (existsSync(audioPath) && existsSync(mappingPath)) {
    return {
      audioPath,
      sentenceTimestamps: JSON.parse(readFileSync(mappingPath, 'utf-8')),
    }
  }

  // Juntar sentenças com espaço extra para pausa natural
  const fullText = sentences.join(' ')

  // Escrever texto em arquivo para evitar problemas com aspas/caracteres especiais no shell
  writeFileSync(textPath, fullText, 'utf-8')

  console.log(`🎙️ Gerando áudio do conto: ${storyId} [${langCode}] (${sentences.length} frases)`)

  try {
    await execFileAsync('python3', [
      '-m', 'edge_tts',
      '--file', textPath,
      '--voice', voice,
      '--rate=-5%',
      '--write-media', audioPath,
      '--write-subtitles', vttPath,
    ], { timeout: 180000, maxBuffer: 10 * 1024 * 1024 })

    // Parsear VTT e mapear para sentenças
    const vttSegments = parseVTT(vttPath)
    const sentenceTimestamps = mapSegmentsToSentences(sentences, vttSegments)

    // Salvar mapeamento
    writeFileSync(mappingPath, JSON.stringify(sentenceTimestamps, null, 2))

    // Limpar arquivos temporários
    if (existsSync(vttPath)) unlinkSync(vttPath)
    if (existsSync(textPath)) unlinkSync(textPath)

    console.log(`✅ Áudio do conto gerado: ${sentences.length} frases mapeadas`)

    return { audioPath, sentenceTimestamps }
  } catch (error) {
    // Limpar arquivo de texto temporário em caso de erro
    if (existsSync(textPath)) unlinkSync(textPath)
    console.error(`❌ Erro TTS conto ${storyId}[${langCode}]:`, error.message)
    throw new Error(`Falha ao gerar áudio do conto: ${error.message}`)
  }
}

// ── Checar se áudio existe em cache ───────────────────────────
export function hasCachedAudio(storyId, langCode) {
  const audioPath = join(CACHE_DIR, `${storyId}_${langCode}.mp3`)
  const mappingPath = join(CACHE_DIR, `${storyId}_${langCode}_sentences.json`)
  return existsSync(audioPath) && existsSync(mappingPath)
}

// ── Obter path do áudio em cache ──────────────────────────────
export function getCachedAudioPath(storyId, langCode) {
  return join(CACHE_DIR, `${storyId}_${langCode}.mp3`)
}

// ── Parsear arquivo VTT (WebVTT) ─────────────────────────────
function parseVTT(vttPath) {
  if (!existsSync(vttPath)) return []

  const content = readFileSync(vttPath, 'utf-8')
  const segments = []

  // Formato edge-tts VTT:
  // 1
  // 00:00:00,100 --> 00:00:02,137
  // Once upon a time
  const blocks = content.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // Encontrar a linha com timestamps
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue

    const textLines = lines.filter(
      (l) => !l.includes('-->') && !/^\d+$/.test(l.trim()) && l.trim() !== 'WEBVTT'
    )
    const text = textLines.join(' ').trim()
    if (!text) continue

    const [startStr, endStr] = timeLine.split('-->')
    const start = parseVTTTime(startStr.trim())
    const end = parseVTTTime(endStr.trim())

    segments.push({ start, end, text })
  }

  return segments
}

// ── Converter timestamp VTT para segundos ─────────────────────
function parseVTTTime(timeStr) {
  // Formato: 00:00:00,100 ou 00:00:00.100
  const normalized = timeStr.replace(',', '.')
  const parts = normalized.split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s)
  }
  if (parts.length === 2) {
    const [m, s] = parts
    return parseFloat(m) * 60 + parseFloat(s)
  }
  return parseFloat(normalized) || 0
}

// ── Mapear segmentos VTT para sentenças originais ─────────────
// edge-tts gera um segmento VTT por frase, então mapeamos 1:1.
// Se o número de segmentos difere (raro), faz best-effort matching.
function mapSegmentsToSentences(sentences, vttSegments) {
  if (!vttSegments.length) {
    // Fallback: distribuir tempo uniformemente
    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
    const estimatedDuration = totalChars * 0.06
    let currentTime = 0
    return sentences.map((text) => {
      const duration = (text.length / totalChars) * estimatedDuration
      const start = currentTime
      const end = currentTime + duration
      currentTime = end + 0.3
      return { text, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 }
    })
  }

  // Mapeamento direto 1:1 — segmentos VTT correspondem às frases
  if (vttSegments.length === sentences.length) {
    return sentences.map((text, i) => ({
      text,
      start: vttSegments[i].start,
      end: vttSegments[i].end,
    }))
  }

  // Se o número de segmentos difere, usar abordagem de similaridade textual
  console.log(`⚠️ VTT tem ${vttSegments.length} segmentos vs ${sentences.length} frases — usando matching por texto`)

  const results = []
  let segIdx = 0

  for (const sentence of sentences) {
    if (segIdx >= vttSegments.length) {
      // Sem mais segmentos, estimar a partir do último
      const prev = results[results.length - 1]
      const fallbackStart = prev ? prev.end + 0.3 : 0
      results.push({ text: sentence, start: fallbackStart, end: fallbackStart + 2 })
      continue
    }

    // Encontrar o melhor segmento VTT para esta frase (maior similaridade)
    let bestIdx = segIdx
    let bestScore = -1
    const sentenceNorm = normalizeForMatch(sentence)

    for (let i = segIdx; i < Math.min(segIdx + 3, vttSegments.length); i++) {
      const segNorm = normalizeForMatch(vttSegments[i].text)
      const score = textSimilarity(sentenceNorm, segNorm)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    // Se a frase cobrir mais de um segmento, agrupar
    const seg = vttSegments[bestIdx]
    results.push({ text: sentence, start: seg.start, end: seg.end })
    segIdx = bestIdx + 1
  }

  return results
}

// Similaridade simples por palavras em comum
function textSimilarity(a, b) {
  const wordsA = new Set(a.split(/\s+/))
  const wordsB = new Set(b.split(/\s+/))
  let common = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) common++
  }
  return common / Math.max(wordsA.size, wordsB.size)
}

function normalizeForMatch(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Listar vozes disponíveis ──────────────────────────────────
export function getAvailableVoices() {
  return Object.entries(VOICES).map(([lang, voice]) => ({ lang, voice }))
}
