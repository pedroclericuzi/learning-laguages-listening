const DEEZER_API = 'https://api.deezer.com'

/**
 * Buscar músicas no Deezer
 */
export async function searchSongs(query, limit = 25) {
  const url = `${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Deezer search failed: ${res.status}`)
  const data = await res.json()

  return (data.data || []).map(formatTrack)
}

/**
 * Buscar detalhes de uma track pelo ID
 */
export async function getTrack(id) {
  const res = await fetch(`${DEEZER_API}/track/${id}`)
  if (!res.ok) throw new Error(`Deezer track not found: ${id}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return {
    id: data.id,
    title: data.title,
    artist: data.artist?.name || 'Unknown',
    artistId: data.artist?.id,
    album: data.album?.title || '',
    cover: data.album?.cover_medium || '',
    coverBig: data.album?.cover_big || data.album?.cover_xl || '',
    preview: data.preview || '',
    duration: data.duration,
    language: '',
  }
}

/**
 * Top tracks globais do Deezer
 */
export async function getChart(limit = 20) {
  const res = await fetch(`${DEEZER_API}/chart/0/tracks?limit=${limit}`)
  if (!res.ok) throw new Error('Deezer chart failed')
  const data = await res.json()

  return (data.data || []).map(formatTrack)
}

/**
 * Buscar músicas curadas para aprendizado de idiomas
 */
export async function getLanguageSongs(langCode) {
  const queries = {
    en: 'top english hits',
    es: 'top spanish hits',
    fr: 'top french hits',
    pt: 'top brazilian hits',
    de: 'top german hits',
    it: 'top italian hits',
    ja: 'top japanese hits',
    ko: 'top kpop hits',
  }
  const query = queries[langCode] || `top ${langCode} songs`
  return searchSongs(query, 20)
}

function formatTrack(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist?.name || 'Unknown',
    artistId: track.artist?.id,
    album: track.album?.title || '',
    cover: track.album?.cover_medium || '',
    coverBig: track.album?.cover_big || '',
    preview: track.preview || '',
    duration: track.duration,
  }
}
