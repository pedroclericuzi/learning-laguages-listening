import { Router } from 'express'
import { languages } from '../data/languages.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(languages)
})

export default router
