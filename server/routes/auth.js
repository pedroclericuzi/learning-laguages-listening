import { Router } from 'express'

const router = Router()

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API = 'https://api.spotify.com/v1'

function getClientId() {
  return process.env.SPOTIFY_CLIENT_ID || ''
}
function getClientSecret() {
  return process.env.SPOTIFY_CLIENT_SECRET || ''
}
function getClientUrl() {
  return process.env.CLIENT_URL || 'http://localhost:5173'
}

// ── Iniciar OAuth — redireciona para Spotify ─────────────────
router.get('/spotify', (req, res) => {
  const clientId = getClientId()
  if (!clientId) {
    return res.status(500).json({
      error: 'SPOTIFY_CLIENT_ID não configurado. Veja .env.example',
    })
  }

  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/spotify/callback`
  const scopes = 'user-read-email user-read-private'

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    show_dialog: 'true',
  })

  res.redirect(`${SPOTIFY_AUTH_URL}?${params}`)
})

// ── Callback do OAuth — troca code por token ─────────────────
router.get('/spotify/callback', async (req, res) => {
  const { code, error: authError } = req.query

  if (authError || !code) {
    return res.redirect(`${getClientUrl()}/settings?spotify_error=no_code`)
  }

  try {
    const clientId = getClientId()
    const clientSecret = getClientSecret()
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/spotify/callback`

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error('Spotify token error:', tokenData)
      return res.redirect(`${getClientUrl()}/settings?spotify_error=token_failed`)
    }

    // Redirecionar para o client com o token
    res.redirect(`${getClientUrl()}/settings?spotify_token=${tokenData.access_token}`)
  } catch (e) {
    console.error('Spotify callback error:', e.message)
    res.redirect(`${getClientUrl()}/settings?spotify_error=server_error`)
  }
})

// ── Info do usuário Spotify (verificar se conectado + premium) ─
router.get('/spotify/me', async (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  try {
    const userRes = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const user = await userRes.json()

    if (user.error) {
      return res.status(401).json({ error: 'Token inválido ou expirado' })
    }

    res.json({
      id: user.id,
      name: user.display_name || user.id,
      email: user.email,
      picture: user.images?.[0]?.url || '',
      country: user.country,
      // product: 'free', 'open', 'premium'
      isPremium: user.product === 'premium',
      offerName: user.product === 'premium' ? 'Premium' : 'Free',
    })
  } catch (e) {
    console.error('Spotify user error:', e.message)
    res.status(500).json({ error: 'Erro ao buscar dados do usuário' })
  }
})

export default router
