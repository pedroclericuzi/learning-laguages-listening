import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiInfo, FiX } from 'react-icons/fi'
import './Toast.css'

const ToastContext = createContext(null)

let _nextId = 0

const ICONS = {
  success: FiCheckCircle,
  error: FiXCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = ++_nextId
    setToasts((prev) => [...prev, { id, message, type }])
    timersRef.current[id] = setTimeout(() => removeToast(id), duration)
    return id
  }, [removeToast])

  const toast = useCallback({
    success: (msg, ms) => addToast(msg, 'success', ms),
    error: (msg, ms) => addToast(msg, 'error', ms),
    warning: (msg, ms) => addToast(msg, 'warning', ms),
    info: (msg, ms) => addToast(msg, 'info', ms),
  }, [addToast])

  // Wrap in useMemo-like stable ref
  const stableToast = useRef(toast)
  stableToast.current = toast

  return (
    <ToastContext.Provider value={stableToast.current}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || FiInfo
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <Icon className="toast__icon" size={18} />
              <span className="toast__message">{t.message}</span>
              <button className="toast__close" onClick={() => removeToast(t.id)}>
                <FiX size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
