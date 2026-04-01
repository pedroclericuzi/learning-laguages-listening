import { useState, useEffect } from 'react'
import { FiGlobe, FiChevronDown } from 'react-icons/fi'
import { useLanguage } from '../../context/LanguageContext'
import './LanguageSwitcher.css'

export default function LanguageSwitcher({ compact = false }) {
  const { nativeLanguage, targetLanguage, setNativeLanguage, setTargetLanguage } = useLanguage()
  const [languages, setLanguages] = useState([])

  useEffect(() => {
    fetch('/api/languages')
      .then((r) => (r.ok ? r.json() : []))
      .then(setLanguages)
      .catch(() => {})
  }, [])

  function handleNativeChange(e) {
    const code = e.target.value
    if (code === targetLanguage) return // não pode ser igual ao idioma alvo
    setNativeLanguage(code)
  }

  function handleTargetChange(e) {
    const code = e.target.value
    if (code === nativeLanguage) return // não pode ser igual ao idioma nativo
    setTargetLanguage(code)
  }

  function flagOf(code) {
    return languages.find((l) => l.code === code)?.flag || '🌍'
  }

  if (compact) {
    // Versão compacta para a barra mobile
    return (
      <div className="lang-switcher lang-switcher--compact">
        <FiGlobe className="lang-switcher__icon" />
        <div className="lang-switcher__select-wrap">
          <span className="lang-switcher__flag">{flagOf(nativeLanguage)}</span>
          <select
            className="lang-switcher__select"
            value={nativeLanguage || ''}
            onChange={handleNativeChange}
            title="Seu idioma"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} disabled={l.code === targetLanguage}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <FiChevronDown className="lang-switcher__chevron" />
        </div>
        <span className="lang-switcher__arrow">→</span>
        <div className="lang-switcher__select-wrap">
          <span className="lang-switcher__flag">{flagOf(targetLanguage)}</span>
          <select
            className="lang-switcher__select"
            value={targetLanguage || ''}
            onChange={handleTargetChange}
            title="Idioma que aprendo"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} disabled={l.code === nativeLanguage}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <FiChevronDown className="lang-switcher__chevron" />
        </div>
      </div>
    )
  }

  // Versão completa para sidebar desktop
  return (
    <div className="lang-switcher">
      <p className="lang-switcher__heading">
        <FiGlobe /> Idiomas
      </p>

      <div className="lang-switcher__row">
        <span className="lang-switcher__label">Falo</span>
        <div className="lang-switcher__select-wrap">
          <span className="lang-switcher__flag">{flagOf(nativeLanguage)}</span>
          <select
            className="lang-switcher__select"
            value={nativeLanguage || ''}
            onChange={handleNativeChange}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} disabled={l.code === targetLanguage}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <FiChevronDown className="lang-switcher__chevron" />
        </div>
      </div>

      <div className="lang-switcher__row">
        <span className="lang-switcher__label">Aprendo</span>
        <div className="lang-switcher__select-wrap">
          <span className="lang-switcher__flag">{flagOf(targetLanguage)}</span>
          <select
            className="lang-switcher__select"
            value={targetLanguage || ''}
            onChange={handleTargetChange}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} disabled={l.code === nativeLanguage}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <FiChevronDown className="lang-switcher__chevron" />
        </div>
      </div>
    </div>
  )
}
