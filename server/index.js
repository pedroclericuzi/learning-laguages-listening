import express from 'express'
import cors from 'cors'
import languagesRouter from './routes/languages.js'
import songsRouter from './routes/songs.js'
import favoritesRouter from './routes/favorites.js'
import storiesRouter from './routes/stories.js'
import translateRouter from './routes/translate.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Rotas
app.use('/api/languages', languagesRouter)
app.use('/api/songs', songsRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/stories', storiesRouter)
app.use('/api/translate', translateRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: '3L API' })
})

app.listen(PORT, () => {
  console.log(`🎵 3L API rodando em http://localhost:${PORT}`)
})
