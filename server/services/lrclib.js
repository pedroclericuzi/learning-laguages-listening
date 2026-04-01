const LRCLIB_API = 'https://lrclib.net/api'

/**
 * Buscar letras sincronizadas no LRCLIB
 */
export async function getLyrics(artist, title, album = '', duration = 0) {
  // Tentar busca exata primeiro
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  })
  if (album) params.set('album_name', album)
  if (duration) params.set('duration', String(duration))

  try {
    const res = await fetch(`${LRCLIB_API}/get?${params}`, {
      headers: { 'User-Agent': '3L App v1.0.0' },
    })

    if (res.ok) {
      const data = await res.json()
      return formatLyrics(data)
    }
  } catch (e) {
    console.warn('LRCLIB get failed, trying search:', e.message)
  }

  // Fallback: busca por texto
  return searchLyrics(`${artist} ${title}`)
}

/**
 * Buscar letras por texto livre
 */
export async function searchLyrics(query) {
  try {
    const res = await fetch(
      `${LRCLIB_API}/search?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': '3L App v1.0.0' } }
    )
    if (!res.ok) return null

    const results = await res.json()
    if (!results.length) return null

    // Pegar o melhor resultado (primeiro com synced lyrics)
    const best =
      results.find((r) => r.syncedLyrics) || results.find((r) => r.plainLyrics)
    if (!best) return null

    return formatLyrics(best)
  } catch (e) {
    console.error('LRCLIB search error:', e.message)
    return null
  }
}

/**
 * Formatar resposta do LRCLIB para nosso formato
 */
function formatLyrics(data) {
  if (!data) return null

  const result = {
    source: 'lrclib',
    synced: false,
    lines: [],
  }

  // Preferir letras sincronizadas
  if (data.syncedLyrics) {
    result.synced = true
    result.lines = parseLRC(data.syncedLyrics)
  } else if (data.plainLyrics) {
    result.lines = data.plainLyrics
      .split('\n')
      .filter((line) => line.trim())
      .map((text) => ({ text: text.trim() }))
  }

  return result
}

/**
 * Parser de formato LRC (letras sincronizadas)
 *
 * Formato: [MM:SS.xx] Texto da linha
 */
function parseLRC(lrc) {
  const lines = lrc.split('\n').filter(Boolean)
  const parsed = []

  for (const line of lines) {
    // Match [00:12.34] ou [00:12.345]
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseFloat(match[2])
    const start = minutes * 60 + seconds
    const text = match[3].trim()

    // Pular linhas vazias (breaks instrumentais)
    if (!text) continue

    parsed.push({ start, text })
  }

  // Calcular end time de cada linha (= start da próxima)
  for (let i = 0; i < parsed.length; i++) {
    parsed[i].end = parsed[i + 1]?.start || parsed[i].start + 5
  }

  return parsed
}
