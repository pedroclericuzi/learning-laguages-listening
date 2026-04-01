import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useSpotify } from '../../context/SpotifyContext'
import { useToast } from '../../components/Toast'
import './Settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { nativeLanguage, targetLanguage, reset } = useLanguage()
  const { isConnected, isPremium, user, loading: spotifyLoading, connect, disconnect, startAuth } = useSpotify()
  const toast = useToast()
  const [languages, setLanguages] = useState([])

  // Capturar token do callback OAuth
  useEffect(() => {
    const token = searchParams.get('spotify_token')
    const error = searchParams.get('spotify_error')

    if (token) {
      connect(token)
      toast.success('Spotify conectado com sucesso!')
      setSearchParams({}, { replace: true })
    } else if (error) {
      const messages = {
        no_code: 'Autorização negada pelo Spotify',
        token_failed: 'Falha ao obter token do Spotify',
        server_error: 'Erro no servidor durante autenticação',
      }
      toast.error(messages[error] || 'Erro ao conectar com Spotify')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/languages')
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao carregar idiomas')
        return r.json()
      })
      .then(setLanguages)
      .catch(() => {
        toast.error('Falha ao carregar lista de idiomas')
      })
  }, [])

  function getLangName(code) {
    const lang = languages.find((l) => l.code === code)
    return lang ? `${lang.flag} ${lang.name}` : code
  }

  function handleReset() {
    if (window.confirm('Deseja redefinir os idiomas? Você voltará para a tela de seleção.')) {
      reset()
      navigate('/onboarding/native', { replace: true })
    }
  }

  return (
    <div className="settings">
      <h1 className="settings__title">⚙️ Configurações</h1>

      <div className="settings__section">
        <h2 className="settings__section-title">Idiomas</h2>
        <div className="settings__item">
          <span className="settings__item-label">Seu idioma</span>
          <span className="settings__item-value">
            {getLangName(nativeLanguage)}
          </span>
        </div>
        <div className="settings__item">
          <span className="settings__item-label">Aprendendo</span>
          <span className="settings__item-value">
            {getLangName(targetLanguage)}
          </span>
        </div>
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Spotify</h2>
        {spotifyLoading ? (
          <div className="settings__item">
            <span className="settings__item-label">Verificando conexão...</span>
          </div>
        ) : isConnected ? (
          <>
            <div className="settings__item">
              <span className="settings__item-label">Conta</span>
              <span className="settings__item-value">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt=""
                    className="settings__spotify-avatar"
                  />
                )}
                {user?.name || 'Conectado'}
              </span>
            </div>
            <div className="settings__item">
              <span className="settings__item-label">Plano</span>
              <span className={`settings__item-value ${isPremium ? 'settings__item-value--premium' : ''}`}>
                {isPremium ? '💚 ' : ''}{user?.offerName || (isPremium ? 'Premium' : 'Free')}
              </span>
            </div>
            {isPremium && (
              <div className="settings__spotify-info">
                Músicas completas disponíveis no Player via widget Spotify
              </div>
            )}
            <button className="settings__spotify-btn settings__spotify-btn--disconnect" onClick={disconnect}>
              Desconectar Spotify
            </button>
          </>
        ) : (
          <>
            <div className="settings__spotify-info">
              Conecte sua conta Spotify Premium para ouvir músicas completas
            </div>
            <button className="settings__spotify-btn settings__spotify-btn--connect" onClick={startAuth}>
              🎵 Conectar Spotify
            </button>
          </>
        )}
      </div>

      <div className="settings__section">
        <h2 className="settings__section-title">Sobre</h2>
        <div className="settings__item">
          <span className="settings__item-label">App</span>
          <span className="settings__item-value">3L</span>
        </div>
        <div className="settings__item">
          <span className="settings__item-label">Descrição</span>
          <span className="settings__item-value" style={{ color: 'var(--color-text-secondary)', fontWeight: 400, fontSize: '0.8rem' }}>
            Learn Languages Listening
          </span>
        </div>
      </div>

      <button className="settings__reset-btn" onClick={handleReset}>
        Redefinir idiomas
      </button>

      <p className="settings__version">3L v1.0.0</p>
    </div>
  )
}
