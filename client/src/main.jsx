import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import { FavoritesProvider } from './context/FavoritesContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <FavoritesProvider>
          <App />
        </FavoritesProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
)
