const SPOTIFY_API = 'https://api.spotify.com/v1'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

// ── Client Credentials token (server-side, sem user auth) ────
let cachedToken = null
let tokenExpiry = 0

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID ou SPOTIFY_CLIENT_SECRET não configurado')
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`)
  const data = await res.json()

  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000 // renova 1min antes
  return cachedToken
}

async function spotifyFetch(endpoint) {
  const token = await getAccessToken()
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    // Spotify retorna texto plano em alguns erros (ex: 403 Premium required)
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Spotify API error: ${res.status}`)
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `Spotify API error: ${res.status}`)
  }
  return res.json()
}

/**
 * Buscar músicas no Spotify
 */
export async function searchSongs(query, limit = 25) {
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
  )
  return (data.tracks?.items || []).map(formatTrack)
}

/**
 * Buscar detalhes de uma track pelo ID
 */
export async function getTrack(id) {
  const data = await spotifyFetch(`/tracks/${id}`)
  return {
    id: data.id,
    title: data.name,
    artist: data.artists?.map((a) => a.name).join(', ') || 'Unknown',
    artistId: data.artists?.[0]?.id || '',
    album: data.album?.name || '',
    cover: data.album?.images?.find((i) => i.width === 300)?.url
      || data.album?.images?.[1]?.url || '',
    coverBig: data.album?.images?.[0]?.url || '',
    preview: data.preview_url || '',
    duration: Math.round(data.duration_ms / 1000),
    spotifyUrl: data.external_urls?.spotify || '',
  }
}

/**
 * Top tracks globais (via busca de hits populares)
 */
export async function getChart(limit = 20) {
  // Spotify editorial playlists requerem permissões especiais.
  // Usamos busca por termos populares como alternativa.
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent('top hits 2025')}&type=track&limit=${limit}`
  )
  return (data.tracks?.items || []).map(formatTrack)
}

/**
 * Músicas curadas para aprendizado de idiomas
 */
export async function getLanguageSongs(langCode) {
  const queries = {
    en: 'top hits english',
    es: 'top hits spanish',
    fr: 'top hits french',
    pt: 'top hits brazilian',
    de: 'top hits german',
    it: 'top hits italian',
    ja: 'top hits japanese',
    ko: 'top hits kpop',
  }
  const query = queries[langCode] || `top ${langCode} songs`
  return searchSongs(query, 20)
}

function formatTrack(track) {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
    artistId: track.artists?.[0]?.id || '',
    album: track.album?.name || '',
    cover: track.album?.images?.find((i) => i.width === 300)?.url
      || track.album?.images?.[1]?.url || '',
    coverBig: track.album?.images?.[0]?.url || '',
    preview: track.preview_url || '',
    duration: Math.round(track.duration_ms / 1000),
    spotifyUrl: track.external_urls?.spotify || '',
  }
}
