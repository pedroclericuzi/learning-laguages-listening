// ── Palavras comuns que não devem ser removidas (stop words) ──
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'and', 'or', 'but',
  'not', 'no', 'so', 'if', 'as', 'it', 'its', 'he', 'she', 'we', 'they',
  'i', 'me', 'my', 'you', 'your', 'his', 'her', 'our', 'them', 'their',
  'him', 'us', 'do', 'did', 'does', 'had', 'has', 'have', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'that', 'this', 'these',
  'those', 'what', 'who', 'whom', 'which', 'how', 'when', 'where', 'there',
  'up', 'out', 'into', 'from', 'than', 'then', 'very', 'just', 'also',
  'too', 'all', 'each', 'both', 'some', 'any', 'one', 'two', 'said',
  // Japonês: partículas e palavras auxiliares comuns
  'は', 'が', 'を', 'に', 'で', 'と', 'の', 'も', 'か', 'へ', 'や', 'から',
  'まで', 'より', 'な', 'だ', 'です', 'ます', 'た', 'て', 'し', 'れ', 'る',
  // Coreano: partículas e auxiliares comuns
  '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로',
])

const CJK_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/
const LATIN_WORD_REGEX = /[a-zA-ZÀ-ÿ']+/g

function isCJK(text) {
  return CJK_REGEX.test(text)
}

function segmentWords(text) {
  if (isCJK(text)) {
    try {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
      return [...segmenter.segment(text)]
        .filter((seg) => seg.isWordLike)
        .map((seg) => ({ word: seg.segment, index: seg.index }))
    } catch {
      const tokens = []
      const regex = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]{2,})/g
      let m
      while ((m = regex.exec(text)) !== null) {
        tokens.push({ word: m[0], index: m.index })
      }
      return tokens
    }
  }
  const tokens = []
  let m
  while ((m = LATIN_WORD_REGEX.exec(text)) !== null) {
    tokens.push({ word: m[0], index: m.index })
  }
  LATIN_WORD_REGEX.lastIndex = 0
  return tokens
}

function isCandidate(word) {
  if (STOP_WORDS.has(word.toLowerCase())) return false
  if (isCJK(word)) return word.length >= 2
  return word.length >= 3
}

/**
 * Gera dados de "fill-in-the-blank" para cada frase.
 * @param {string[]} sentences - Array de frases de texto puro
 * @returns {Array<{blankedText, answer, options} | null>}
 */
export function generateBlanks(sentences) {
  const allWords = new Set()
  for (const s of sentences) {
    for (const { word } of segmentWords(s)) {
      if (isCandidate(word)) allWords.add(word.toLowerCase())
    }
  }
  const wordPool = [...allWords]

  return sentences.map((sentence) => {
    const words = segmentWords(sentence)
    const candidates = words.filter(({ word }) => isCandidate(word))
    if (candidates.length === 0) return null

    const seed = sentence.length * 7 + sentence.charCodeAt(0)
    const chosen = candidates[seed % candidates.length]

    const blankedText =
      sentence.slice(0, chosen.index) +
      '______' +
      sentence.slice(chosen.index + chosen.word.length)

    const answer = chosen.word
    const answerLower = answer.toLowerCase()
    const answerLen = answer.length

    let distractorPool = wordPool
      .filter((w) => w !== answerLower)
      .map((w) => ({ w, diff: Math.abs(w.length - answerLen) }))
      .sort((a, b) => a.diff - b.diff)
      .map(({ w }) => w)

    const distractors = []
    const usedSet = new Set([answerLower])
    for (const w of distractorPool) {
      if (!usedSet.has(w)) {
        let formatted = w
        if (!isCJK(w) && answer[0] === answer[0].toUpperCase()) {
          formatted = w.charAt(0).toUpperCase() + w.slice(1)
        }
        distractors.push(formatted)
        usedSet.add(w)
        if (distractors.length >= 3) break
      }
    }

    const options = [...distractors, answer]
    for (let i = options.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) + i * 3) % (i + 1)
      ;[options[i], options[j]] = [options[j], options[i]]
    }

    return { blankedText, answer, options }
  })
}
