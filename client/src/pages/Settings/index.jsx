import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import './Settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const { nativeLanguage, targetLanguage, reset } = useLanguage()
  const [languages, setLanguages] = useState([])

  useEffect(() => {
    fetch('/api/languages')
      .then((r) => r.json())
      .then(setLanguages)
      .catch(console.error)
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
