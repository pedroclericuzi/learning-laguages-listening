import { Router } from 'express'
import { searchSongs, getTrack, getChart, getLanguageSongs } from '../services/spotify.js'
import { getLyrics } from '../services/lrclib.js'
import { translateLyrics, detectLanguage } from '../services/translator.js'
import { generateBlanks } from '../services/blanks.js'

const router = Router()

// ── Buscar músicas (Spotify search) ──────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q, limit } = req.query
    if (!q) return res.status(400).json({ error: 'Parâmetro "q" é obrigatório' })

    const songs = await searchSongs(q, Number(limit) || 25)
    res.json(songs)
  } catch (e) {
    console.error('Search error:', e.message)
    res.status(500).json({ error: 'Erro ao buscar músicas' })
  }
})

// ── Músicas populares (Spotify chart) ────────────────────────
router.get('/popular', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20
    const songs = await getChart(limit)
    res.json(songs)
  } catch (e) {
    console.error('Chart error:', e.message)
    res.status(500).json({ error: 'Erro ao buscar populares' })
  }
})

// ── Músicas por idioma ───────────────────────────────────────
router.get('/language/:code', async (req, res) => {
  try {
    const songs = await getLanguageSongs(req.params.code)
    res.json(songs)
  } catch (e) {
    console.error('Language songs error:', e.message)
    res.status(500).json({ error: 'Erro ao buscar músicas por idioma' })
  }
})

// ── Detalhes de uma música (Spotify track) ───────────────────
router.get('/:id', async (req, res) => {
  try {
    const track = await getTrack(req.params.id)
    res.json(track)
  } catch (e) {
    console.error('Track error:', e.message)
    res.status(404).json({ error: 'Música não encontrada' })
  }
})

// ── Letras + tradução ────────────────────────────────────────
router.get('/:id/lyrics', async (req, res) => {
  try {
    const { translate: targetLang } = req.query

    // 1. Buscar info da música no Spotify
    const track = await getTrack(req.params.id)

    // 2. Buscar letras no LRCLIB
    const lyrics = await getLyrics(track.artist, track.title, track.album, track.duration)

    if (!lyrics || !lyrics.lines.length) {
      return res.json({
        track: { id: track.id, title: track.title, artist: track.artist },
        lyrics: null,
        message: 'Letras não encontradas para esta música',
      })
    }

    // 3. Detectar idioma da letra
    const sampleText = lyrics.lines.slice(0, 3).map((l) => l.text).join(' ')
    const detectedLang = await detectLanguage(sampleText)

    // 4. Traduzir se idioma alvo fornecido
    let translatedLines = lyrics.lines
    if (targetLang && targetLang !== detectedLang) {
      translatedLines = await translateLyrics(lyrics.lines, detectedLang, targetLang)
    }

    // 5. Gerar blanks (fill-in-the-blank) apenas em letras sincronizadas
    let finalLines = translatedLines
    if (lyrics.synced) {
      const blanks = generateBlanks(translatedLines.map((l) => l.text))
      finalLines = translatedLines.map((l, i) => ({ ...l, blank: blanks[i] || null }))
    }

    res.json({
      track: { id: track.id, title: track.title, artist: track.artist },
      synced: lyrics.synced,
      language: detectedLang,
      lines: finalLines,
    })
  } catch (e) {
    console.error('Lyrics error:', e.message)
    res.status(500).json({ error: 'Erro ao buscar letras' })
  }
})

export default router
