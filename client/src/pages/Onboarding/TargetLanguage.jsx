import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import './Onboarding.css'

export default function TargetLanguage() {
  const navigate = useNavigate()
  const { nativeLanguage, setTargetLanguage } = useLanguage()
  const [languages, setLanguages] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!nativeLanguage) {
      navigate('/onboarding/native', { replace: true })
      return
    }
    fetch('/api/languages')
      .then((res) => res.json())
      .then((data) => {
        // Remover o idioma nativo da lista
        setLanguages(data.filter((l) => l.code !== nativeLanguage))
      })
      .catch(console.error)
  }, [nativeLanguage, navigate])

  function handleContinue() {
    if (selected) {
      setTargetLanguage(selected)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__logo">3L</h1>
      <p className="onboarding__subtitle">Learn Languages Listening</p>

      <span className="onboarding__step">Passo 2 de 2</span>
      <h2 className="onboarding__title">O que quer aprender?</h2>
      <p className="onboarding__description">
        Selecione o idioma que deseja aprender com músicas
      </p>

      <div className="onboarding__grid">
        {languages.map((lang) => (
          <button
            key={lang.code}
            className={`onboarding__card ${
              selected === lang.code ? 'onboarding__card--selected' : ''
            }`}
            onClick={() => setSelected(lang.code)}
          >
            <span className="onboarding__flag">{lang.flag}</span>
            <span className="onboarding__lang-name">{lang.name}</span>
          </button>
        ))}
      </div>

      <button
        className={`onboarding__btn ${selected ? 'onboarding__btn--active' : ''}`}
        onClick={handleContinue}
      >
        Começar 🎵
      </button>
    </div>
  )
}
