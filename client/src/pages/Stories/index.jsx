import { useState, useEffect } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import StoryCard from '../../components/StoryCard'
import './Stories.css'

export default function Stories() {
  const { targetLanguage } = useLanguage()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stories?lang=${targetLanguage}`)
      .then((r) => r.json())
      .then(setStories)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [targetLanguage])

  const filtered =
    filter === 'all'
      ? stories
      : stories.filter((s) => s.difficulty === filter)

  return (
    <div className="stories">
      <div className="stories__header">
        <h1 className="stories__title">📖 Contos de Fadas</h1>
        <p className="stories__subtitle">
          Aprenda idiomas ouvindo histórias clássicas com texto sincronizado
        </p>
      </div>

      {/* Filtros de dificuldade */}
      <div className="stories__filters">
        {[
          { key: 'all', label: 'Todos', emoji: '📚' },
          { key: 'beginner', label: 'Iniciante', emoji: '🌱' },
          { key: 'intermediate', label: 'Intermediário', emoji: '🌿' },
          { key: 'advanced', label: 'Avançado', emoji: '🌳' },
        ].map((f) => (
          <button
            key={f.key}
            className={`stories__filter-chip ${filter === f.key ? 'stories__filter-chip--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {/* Grid de contos */}
      <div className="stories__grid">
        {loading ? (
          <div className="stories__empty">Carregando contos...</div>
        ) : filtered.length > 0 ? (
          filtered.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))
        ) : (
          <div className="stories__empty">
            Nenhum conto encontrado para este filtro
          </div>
        )}
      </div>
    </div>
  )
}
