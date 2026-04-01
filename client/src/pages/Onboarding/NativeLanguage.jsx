import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import './Onboarding.css'

export default function NativeLanguage() {
  const navigate = useNavigate()
  const { setNativeLanguage, nativeLanguage } = useLanguage()
  const [languages, setLanguages] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/api/languages')
      .then((res) => res.json())
      .then(setLanguages)
      .catch(console.error)
  }, [])

  function handleContinue() {
    if (selected) {
      setNativeLanguage(selected)
      navigate('/onboarding/target')
    }
  }

  return (
    <div className="onboarding">
      <h1 className="onboarding__logo">3L</h1>
      <p className="onboarding__subtitle">Learn Languages Listening</p>

      <span className="onboarding__step">Passo 1 de 2</span>
      <h2 className="onboarding__title">Qual é o seu idioma?</h2>
      <p className="onboarding__description">
        Selecione o idioma que você já fala
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
        Continuar →
      </button>
    </div>
  )
}
