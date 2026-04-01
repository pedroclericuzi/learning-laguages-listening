import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { SpotifyProvider } from './context/SpotifyContext'
import { ReportProvider } from './context/ReportContext'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <LanguageProvider>
          <FavoritesProvider>
            <SpotifyProvider>
              <ReportProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </ReportProvider>
            </SpotifyProvider>
          </FavoritesProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
