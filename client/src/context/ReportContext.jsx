import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = '3l-report'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { stories: [], songs: [] }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

const ReportContext = createContext(null)

export function ReportProvider({ children }) {
  const [report, setReport] = useState(loadFromStorage)

  const saveStoryResult = useCallback((id, title, correct, total) => {
    if (total === 0) return
    setReport((prev) => {
      const entry = {
        id,
        title,
        date: new Date().toISOString(),
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      }
      const updated = {
        ...prev,
        stories: [entry, ...prev.stories].slice(0, 200), // keep last 200
      }
      saveToStorage(updated)
      return updated
    })
  }, [])

  const saveSongResult = useCallback((id, title, correct, total) => {
    if (total === 0) return
    setReport((prev) => {
      const entry = {
        id,
        title,
        date: new Date().toISOString(),
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      }
      const updated = {
        ...prev,
        songs: [entry, ...prev.songs].slice(0, 200),
      }
      saveToStorage(updated)
      return updated
    })
  }, [])

  const clearReport = useCallback(() => {
    const empty = { stories: [], songs: [] }
    saveToStorage(empty)
    setReport(empty)
  }, [])

  return (
    <ReportContext.Provider value={{ report, saveStoryResult, saveSongResult, clearReport }}>
      {children}
    </ReportContext.Provider>
  )
}

export function useReport() {
  const ctx = useContext(ReportContext)
  if (!ctx) throw new Error('useReport must be used within ReportProvider')
  return ctx
}
