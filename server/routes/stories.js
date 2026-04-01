import { Router } from 'express'
import { stories, storyTitles } from '../data/stories.js'
import { generateStoryAudio, hasCachedAudio, getCachedAudioPath } from '../services/tts.js'
import { translateLyrics } from '../services/translator.js'

const router = Router()

// ── Palavras comuns que não devem ser removidas (stop words) ──
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'and', 'or', 'but',
  'not', 'no', 'so', 'if', 'as', 'it', 'its', 'he', 'she', 'we', 'they',
  'i', 'me', 'my', 'you', 'your', 'his', 'her', 'our', 'them', 'their',
  'him', 'us', 'do', 'did', 'does', 'had', 'has', 'have', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'that', 'this', 'these',
  'those', 'what', 'who', 'whom', 'which', 'how', 'when', 'where', 'there',
  'up', 'out', 'into', 'from', 'than', 'then', 'very', 'just', 'also',
  'too', 'all', 'each', 'both', 'some', 'any', 'one', 'two', 'said',
])

/**
 * Gera dados de "fill-in-the-blank" para cada frase.
 * - Escolhe uma palavra significativa (não stop word, >= 3 letras)
 * - Gera 3 distratores de outras palavras do texto
 * - Retorna: { blankedText, answer, options[] }
 */
function generateBlanks(sentences) {
  // Coletar todas as palavras significativas do texto inteiro
  const allWords = new Set()
  for (const s of sentences) {
    const words = s.match(/[a-zA-ZÀ-ÿ']+/g) || []
    for (const w of words) {
      if (w.length >= 3 && !STOP_WORDS.has(w.toLowerCase())) {
        allWords.add(w.toLowerCase())
      }
    }
  }
  const wordPool = [...allWords]

  return sentences.map((sentence) => {
    // Extrair palavras candidatas com suas posições
    const candidates = []
    const regex = /[a-zA-ZÀ-ÿ']+/g
    let match
    while ((match = regex.exec(sentence)) !== null) {
      const word = match[0]
      if (word.length >= 3 && !STOP_WORDS.has(word.toLowerCase())) {
        candidates.push({ word, index: match.index })
      }
    }

    if (candidates.length === 0) {
      return null // Frase sem candidatos (muito curta)
    }

    // Escolher palavra aleatória determinística (baseado na frase para consistência)
    const seed = sentence.length * 7 + sentence.charCodeAt(0)
    const chosen = candidates[seed % candidates.length]

    // Criar texto com lacuna
    const blankedText =
      sentence.slice(0, chosen.index) +
      '______' +
      sentence.slice(chosen.index + chosen.word.length)

    // Gerar 3 distratores (palavras do mesmo texto, tamanho similar)
    const answer = chosen.word
    const answerLower = answer.toLowerCase()
    const answerLen = answer.length

    // Filtrar pool: palavras diferentes da resposta, próximas em tamanho
    let distractorPool = wordPool
      .filter((w) => w !== answerLower)
      .map((w) => ({ w, diff: Math.abs(w.length - answerLen) }))
      .sort((a, b) => a.diff - b.diff)
      .map(({ w }) => w)

    // Pegar até 3 distratores
    const distractors = []
    const usedSet = new Set([answerLower])
    for (const w of distractorPool) {
      if (!usedSet.has(w)) {
        // Capitalizar como a resposta se necessário
        const formatted = answer[0] === answer[0].toUpperCase()
          ? w.charAt(0).toUpperCase() + w.slice(1)
          : w
        distractors.push(formatted)
        usedSet.add(w)
        if (distractors.length >= 3) break
      }
    }

    // Montar opções embaralhadas
    const options = [...distractors, answer]
    // Shuffle determinístico
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) + i * 3) % (i + 1)
      ;[options[i], options[j]] = [options[j], options[i]]
    }

    return { blankedText, answer, options }
  })
}

// ── Listar todos os contos ────────────────────────────────────
router.get('/', (req, res) => {
  const { lang } = req.query // idioma para títulos (default: en)
  const displayLang = lang || 'en'

  const list = stories.map((story) => ({
    id: story.id,
    title: storyTitles[story.id]?.[displayLang] || storyTitles[story.id]?.en || story.id,
    emoji: story.emoji,
    difficulty: story.difficulty,
    author: story.author,
    sentenceCount: story.sentences.length,
    estimatedMinutes: Math.ceil(story.sentences.join(' ').length / 800), // ~800 chars/min narração
    hasCachedAudio: hasCachedAudio(story.id, displayLang),
  }))

  res.json(list)
})

// ── Detalhes de um conto ──────────────────────────────────────
router.get('/:id', (req, res) => {
  const { lang } = req.query
  const displayLang = lang || 'en'

  const story = stories.find((s) => s.id === req.params.id)
  if (!story) return res.status(404).json({ error: 'Conto não encontrado' })

  res.json({
    id: story.id,
    title: storyTitles[story.id]?.[displayLang] || storyTitles[story.id]?.en,
    emoji: story.emoji,
    difficulty: story.difficulty,
    author: story.author,
    sentences: story.sentences,
    sentenceCount: story.sentences.length,
  })
})

// ── Gerar/obter áudio de um conto ─────────────────────────────
// GET /api/stories/:id/audio?lang=en
// Retorna o arquivo MP3
router.get('/:id/audio', async (req, res) => {
  const story = stories.find((s) => s.id === req.params.id)
  if (!story) return res.status(404).json({ error: 'Conto não encontrado' })

  const lang = req.query.lang || 'en'

  try {
    let sentences = story.sentences

    // Se idioma não é inglês, traduzir as sentenças primeiro
    if (lang !== 'en') {
      const lines = sentences.map((text) => ({ text }))
      const translated = await translateLyrics(lines, 'en', lang)
      sentences = translated.map((l) => l.translation || l.text)
    }

    const { audioPath } = await generateStoryAudio(story.id, sentences, lang)

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(audioPath)
  } catch (error) {
    console.error('Audio generation error:', error.message)
    res.status(500).json({ error: 'Falha ao gerar áudio', details: error.message })
  }
})

// ── Obter conteúdo com timestamps + tradução ──────────────────
// GET /api/stories/:id/content?lang=en&translate=pt
// Retorna sentenças com timestamps sincronizados + tradução
router.get('/:id/content', async (req, res) => {
  const story = stories.find((s) => s.id === req.params.id)
  if (!story) return res.status(404).json({ error: 'Conto não encontrado' })

  const lang = req.query.lang || 'en'       // Idioma da narração/texto
  const translateTo = req.query.translate    // Idioma da tradução

  try {
    let sentences = story.sentences

    // Se idioma não é inglês, traduzir as sentenças para o idioma alvo
    if (lang !== 'en') {
      const lines = sentences.map((text) => ({ text }))
      const translated = await translateLyrics(lines, 'en', lang)
      sentences = translated.map((l) => l.translation || l.text)
    }

    // Gerar áudio (ou usar cache) para obter timestamps
    const { sentenceTimestamps } = await generateStoryAudio(story.id, sentences, lang)

    // Preparar resposta com sentenças + timestamps
    let result = sentenceTimestamps.map((st, i) => ({
      text: st.text || sentences[i],
      start: st.start,
      end: st.end,
    }))

    // Traduzir se solicitado
    if (translateTo && translateTo !== lang) {
      const fromLang = lang
      const lines = result.map((r) => ({ ...r }))
      const translated = await translateLyrics(lines, fromLang, translateTo)
      result = result.map((r, i) => ({
        ...r,
        translation: translated[i]?.translation || '',
      }))
    }

    // Gerar blanks (fill-in-the-blank) baseado no texto no idioma narrado
    const blanks = generateBlanks(result.map((r) => r.text))
    result = result.map((r, i) => ({
      ...r,
      blank: blanks[i] || null,
    }))

    res.json({
      id: story.id,
      title: storyTitles[story.id]?.[lang] || storyTitles[story.id]?.en,
      titleTranslated: translateTo
        ? storyTitles[story.id]?.[translateTo] || storyTitles[story.id]?.en
        : undefined,
      language: lang,
      author: story.author,
      difficulty: story.difficulty,
      synced: true,
      lines: result,
    })
  } catch (error) {
    console.error('Content error:', error.message)
    res.status(500).json({ error: 'Falha ao gerar conteúdo', details: error.message })
  }
})

export default router
