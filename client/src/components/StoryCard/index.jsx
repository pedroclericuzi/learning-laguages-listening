import { useNavigate } from 'react-router-dom'
import { FiBookOpen, FiClock } from 'react-icons/fi'
import './StoryCard.css'

const difficultyLabels = {
  beginner: { label: 'Iniciante', className: 'story-card__badge--beginner' },
  intermediate: { label: 'Intermediário', className: 'story-card__badge--intermediate' },
  advanced: { label: 'Avançado', className: 'story-card__badge--advanced' },
}

export default function StoryCard({ story }) {
  const navigate = useNavigate()
  const diff = difficultyLabels[story.difficulty] || difficultyLabels.beginner

  return (
    <div
      className="story-card"
      onClick={() => navigate(`/story/${story.id}`)}
    >
      <div className="story-card__emoji">
        {[...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(story.emoji)].map((seg, i) => (
          <span key={i}>{seg.segment}</span>
        ))}
      </div>
      <div className="story-card__info">
        <div className="story-card__title">{story.title}</div>
        <div className="story-card__author">{story.author}</div>
        <div className="story-card__meta">
          <span className={`story-card__badge ${diff.className}`}>
            {diff.label}
          </span>
          <span className="story-card__stat">
            <FiBookOpen size={12} />
            {story.sentenceCount} frases
          </span>
          <span className="story-card__stat">
            <FiClock size={12} />
            ~{story.estimatedMinutes} min
          </span>
        </div>
      </div>
      {story.hasCachedAudio && (
        <span className="story-card__cached" title="Áudio em cache">⚡</span>
      )}
    </div>
  )
}
