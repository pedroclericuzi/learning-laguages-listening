import { Routes, Route, Navigate } from 'react-router-dom'
import { useLanguage } from './context/LanguageContext'
import NativeLanguage from './pages/Onboarding/NativeLanguage'
import TargetLanguage from './pages/Onboarding/TargetLanguage'
import Home from './pages/Home'
import SongList from './pages/SongList'
import Player from './pages/Player'
import Stories from './pages/Stories'
import StoryPlayer from './pages/StoryPlayer'
import Favorites from './pages/Favorites'
import Settings from './pages/Settings'
import Layout from './components/Layout'

export default function App() {
  const { nativeLanguage, targetLanguage } = useLanguage()
  const isOnboarded = nativeLanguage && targetLanguage

  return (
    <Routes>
      {/* Onboarding */}
      <Route path="/onboarding/native" element={<NativeLanguage />} />
      <Route path="/onboarding/target" element={<TargetLanguage />} />

      {/* App principal (protegido por onboarding) */}
      {isOnboarded ? (
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/songs" element={<SongList />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/story/:id" element={<StoryPlayer />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/onboarding/native" replace />} />
      )}

      {/* Fallback */}
      <Route path="*" element={<Navigate to={isOnboarded ? '/' : '/onboarding/native'} replace />} />
    </Routes>
  )
}
