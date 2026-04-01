import { Router } from 'express'

const router = Router()

// In-memory favorites (em produção seria banco de dados)
const favorites = new Set()

router.get('/', (req, res) => {
  res.json([...favorites])
})

router.post('/:songId', (req, res) => {
  const songId = Number(req.params.songId)
  favorites.add(songId)
  res.json({ added: true, songId })
})

router.delete('/:songId', (req, res) => {
  const songId = Number(req.params.songId)
  favorites.delete(songId)
  res.json({ removed: true, songId })
})

export default router
