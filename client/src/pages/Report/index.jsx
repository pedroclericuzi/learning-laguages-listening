import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBarChart2, FiBookOpen, FiMusic, FiTrash2, FiArrowLeft, FiChevronDown, FiXCircle } from 'react-icons/fi'
import { useReport } from '../../context/ReportContext'
import './Report.css'

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function percentClass(pct) {
  if (pct >= 70) return 'report__bar--good'
  if (pct >= 40) return 'report__bar--mid'
  return 'report__bar--bad'
}

function StatsCards({ sessions }) {
  if (sessions.length === 0) return null

  const total = sessions.length
  const avgPct = Math.round(sessions.reduce((s, r) => s + r.percentage, 0) / total)
  const bestPct = Math.max(...sessions.map((r) => r.percentage))

  return (
    <div className="report__cards">
      <div className="report__card">
        <span className="report__card-value">{total}</span>
        <span className="report__card-label">Sessões</span>
      </div>
      <div className="report__card">
        <span className="report__card-value">{avgPct}%</span>
        <span className="report__card-label">Média de acertos</span>
      </div>
      <div className="report__card">
        <span className="report__card-value">{bestPct}%</span>
        <span className="report__card-label">Melhor resultado</span>
      </div>
    </div>
  )
}

/** Exibe as frases erradas de uma sessão */
function WrongAnswers({ wrongs }) {
  if (!wrongs || wrongs.length === 0) {
    return <p className="report__wrongs-empty">Nenhuma frase errada 🎉</p>
  }
  return (
    <ul className="report__wrongs-list">
      {wrongs.map((w, i) => (
        <li key={i} className="report__wrong-item">
          <span className="report__wrong-text">{w.text}</span>
          <span className="report__wrong-answers">
            <span className="report__wrong-selected">
              <FiXCircle /> {w.selected}
            </span>
            <span className="report__wrong-arrow">→</span>
            <span className="report__wrong-correct">{w.answer}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Linha de sessão individual com expansão de erros */
function SessionRow({ session }) {
  const [open, setOpen] = useState(false)
  const hasWrongs = session.wrongs !== undefined // sessões antigas não têm wrongs

  return (
    <li className={`report__history-item ${open ? 'report__history-item--open' : ''}`}>
      <button
        className="report__history-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{formatDate(session.date)}</span>
        <span className="report__history-score">
          {session.correct}/{session.total} ({session.percentage}%)
        </span>
        {hasWrongs && (
          <FiChevronDown
            className={`report__history-chevron ${open ? 'report__history-chevron--open' : ''}`}
          />
        )}
      </button>
      {open && hasWrongs && (
        <div className="report__wrongs">
          <WrongAnswers wrongs={session.wrongs} />
        </div>
      )}
    </li>
  )
}

function SessionList({ sessions, onNavigate }) {
  if (sessions.length === 0) {
    return (
      <div className="report__empty">
        <FiBarChart2 size={40} />
        <p>Nenhuma sessão registrada ainda.</p>
        <small>Jogue o quiz em um conto ou música para ver suas estatísticas aqui.</small>
      </div>
    )
  }

  // Group by id, keeping latest stats and all sessions
  const grouped = sessions.reduce((acc, s) => {
    if (!acc[s.id]) {
      acc[s.id] = { id: s.id, title: s.title, sessions: [] }
    }
    acc[s.id].sessions.push(s)
    return acc
  }, {})

  const groups = Object.values(grouped)

  return (
    <div className="report__list">
      {groups.map((group) => {
        const best = Math.max(...group.sessions.map((s) => s.percentage))
        const avg = Math.round(
          group.sessions.reduce((s, r) => s + r.percentage, 0) / group.sessions.length
        )
        const latest = group.sessions[0]

        return (
          <div key={group.id} className="report__item">
            <div className="report__item-header">
              <button
                className="report__item-title"
                onClick={() => onNavigate(group.id)}
                title="Abrir novamente"
              >
                {group.title}
              </button>
              <span className="report__item-count">{group.sessions.length}× jogado</span>
            </div>

            <div className="report__item-stats">
              <div className="report__stat">
                <span className="report__stat-label">Última sessão</span>
                <span className="report__stat-value">
                  {latest.correct}/{latest.total} corretas ({latest.percentage}%)
                </span>
                <span className="report__stat-date">{formatDate(latest.date)}</span>
              </div>
              <div className="report__stat">
                <span className="report__stat-label">Melhor / Média</span>
                <span className="report__stat-value">
                  {best}% / {avg}%
                </span>
              </div>
            </div>

            <div className="report__bar-wrap">
              <div
                className={`report__bar ${percentClass(latest.percentage)}`}
                style={{ width: `${latest.percentage}%` }}
              />
            </div>

            <details className="report__history">
              <summary>
                {group.sessions.length > 1
                  ? `Ver histórico (${group.sessions.length} sessões)`
                  : 'Ver detalhes da sessão'}
              </summary>
              <ul className="report__history-list">
                {group.sessions.map((s, i) => (
                  <SessionRow key={i} session={s} />
                ))}
              </ul>
            </details>
          </div>
        )
      })}
    </div>
  )
}

export default function Report() {
  const navigate = useNavigate()
  const { report, clearReport } = useReport()
  const [tab, setTab] = useState('stories')

  const sessions = tab === 'stories' ? report.stories : report.songs
  const handleNavigate = (id) => {
    if (tab === 'stories') navigate(`/story/${id}`)
    else navigate(`/player/${id}`)
  }

  function handleClear() {
    if (window.confirm('Apagar todo o histórico de relatórios?')) {
      clearReport()
    }
  }

  const hasAny = report.stories.length > 0 || report.songs.length > 0

  return (
    <div className="report">
      <div className="report__header">
        <button className="report__back" onClick={() => navigate(-1)} aria-label="Voltar">
          <FiArrowLeft />
        </button>
        <h1 className="report__title">
          <FiBarChart2 /> Relatório
        </h1>
        {hasAny && (
          <button className="report__clear" onClick={handleClear} title="Limpar histórico">
            <FiTrash2 />
          </button>
        )}
      </div>

      <div className="report__tabs">
        <button
          className={`report__tab ${tab === 'stories' ? 'report__tab--active' : ''}`}
          onClick={() => setTab('stories')}
        >
          <FiBookOpen /> Contos
          {report.stories.length > 0 && (
            <span className="report__tab-badge">{report.stories.length}</span>
          )}
        </button>
        <button
          className={`report__tab ${tab === 'songs' ? 'report__tab--active' : ''}`}
          onClick={() => setTab('songs')}
        >
          <FiMusic /> Músicas
          {report.songs.length > 0 && (
            <span className="report__tab-badge">{report.songs.length}</span>
          )}
        </button>
      </div>

      <StatsCards sessions={sessions} />
      <SessionList sessions={sessions} onNavigate={handleNavigate} />
    </div>
  )
}
