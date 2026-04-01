import { Router } from 'express'
import { stories, storyTitles } from '../data/stories.js'
import { generateStoryAudio, hasCachedAudio, getCachedAudioPath } from '../services/tts.js'
import { translateLyrics } from '../services/translator.js'
import { generateBlanks } from '../services/blanks.js'

const router = Router()

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
