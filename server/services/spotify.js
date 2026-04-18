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

// Spotify Client Credentials limita a 10 resultados por request
const SPOTIFY_MAX_LIMIT = 10

// Mapeamento língua → mercado Spotify (filtra resultados disponíveis no país)
const LANG_TO_MARKET = {
  en: 'US',
  es: 'ES',
  fr: 'FR',
  pt: 'BR',
  de: 'DE',
  it: 'IT',
  ja: 'JP',
  ko: 'KR',
}

/**
 * Buscar músicas no Spotify
 * @param {string} query
 * @param {number} limit
 * @param {string} [lang] - código de idioma (en, es, fr…) para filtrar por mercado
 */
export async function searchSongs(query, limit = 10, lang) {
  const safeLimit = Math.min(limit, SPOTIFY_MAX_LIMIT)
  const market = lang ? LANG_TO_MARKET[lang] : undefined
  const marketParam = market ? `&market=${market}` : ''
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${safeLimit}${marketParam}`
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
 * Top tracks globais — múltiplas buscas para contornar limit=10 do Spotify
 */
export async function getChart(limit = 30) {
  const queries = ['top hits 2025', 'viral hits 2024', 'global top songs']
  const perQuery = Math.min(SPOTIFY_MAX_LIMIT, Math.ceil(limit / queries.length))

  const results = await Promise.allSettled(
    queries.map((q) =>
      spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=${perQuery}`)
        .then((d) => (d.tracks?.items || []).map(formatTrack))
    )
  )

  // Juntar resultados, remover duplicatas por ID, respeitar limit
  const seen = new Set()
  const songs = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const s of r.value) {
        if (!seen.has(s.id) && songs.length < limit) {
          seen.add(s.id)
          songs.push(s)
        }
      }
    }
  }
  return songs
}

/**
 * Músicas curadas para aprendizado de idiomas — múltiplas buscas por idioma
 */
export async function getLanguageSongs(langCode) {
  const queryMap = {
    en: ['top english hits', 'popular english songs', 'best english pop'],
    es: ['top spanish hits', 'musica popular espanol', 'reggaeton hits'],
    fr: ['top french hits', 'chanson francaise populaire', 'musique francaise'],
    pt: ['top brazilian hits', 'musica brasileira popular', 'sertanejo hits'],
    de: ['top german hits', 'deutsche musik popular', 'schlager hits'],
    it: ['top italian hits', 'musica italiana popolare', 'pop italiano'],
    ja: ['top japanese hits', 'j-pop popular', 'japanese pop music'],
    ko: ['top kpop hits', 'korean pop popular', 'kpop songs'],
  }

  const queries = queryMap[langCode] || [`top ${langCode} songs`, `${langCode} popular music`]

  const results = await Promise.allSettled(
    queries.map((q) =>
      spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=${SPOTIFY_MAX_LIMIT}`)
        .then((d) => (d.tracks?.items || []).map(formatTrack))
    )
  )

  // Juntar, desduplicar por ID
  const seen = new Set()
  const songs = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const s of r.value) {
        if (!seen.has(s.id)) {
          seen.add(s.id)
          songs.push(s)
        }
      }
    }
  }
  return songs
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
