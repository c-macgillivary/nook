import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'
import wordsUrl from '../data/words.txt?url'
import './wordblock.css'

type WordBlockProps = {
  middle?: string
  onChange?: (word: string) => void
  onSolve?: (word: string) => void
}

type Tile = { id: number; ch: string }

type Side = 'left' | 'right'

type State = {
  prefix: Tile[]
  suffix: Tile[]
  side: Side
  index: number
}

type WordList = {
  /** Every entry, lower-cased, for checking answers. */
  all: Set<string>
  /** Plain-letter words of 3+ letters, for picking middle letters. */
  pickable: string[]
}

// The list is ~4.6 MB, so it is downloaded and parsed once and shared.
let wordListPromise: Promise<WordList> | null = null

function loadWordList(): Promise<WordList> {
  wordListPromise ??= (async () => {
    const response = await fetch(wordsUrl)
    if (!response.ok) {
      throw new Error(`failed to grab the word list: ${response.status} ${response.statusText}`)
    }

    const words = (await response.text())
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter(Boolean)

    const pickable = words.filter((word) => /^[a-z]{3,}$/i.test(word))
    if (pickable.length === 0) {
      throw new Error('the word list contains no words with at least three letters')
    }
    return { all: new Set(words.map((word) => word.toLowerCase())), pickable }
  })().catch((error: unknown) => {
    wordListPromise = null // let the next call try again
    throw error
  })
  return wordListPromise
}

// picks a random 3 letters from the middle of a random word
function get3Letters({ pickable }: WordList): string {
  const word = pickable[Math.floor(Math.random() * pickable.length)].toLowerCase()
  const start = Math.floor((word.length - 3) / 2)
  return word.slice(start, start + 3)
}

const text = (tiles: Tile[]) => tiles.map((t) => t.ch).join('')

const inside = (s: State, side: Side): State => ({
  ...s,
  side,
  index: side === 'left' ? s.prefix.length : 0,
})

// Each batch starts with the cursor on the left of the word.
const EMPTY: State = { prefix: [], suffix: [], side: 'left', index: 0 }

export default function WordBlock({ middle, onChange, onSolve }: WordBlockProps) {
  const [wordList, setWordList] = useState<WordList | null>(null)
  const [randomMiddle, setRandomMiddle] = useState('')
  const [state, setState] = useState<State>(EMPTY)
  const [rejected, setRejected] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const middleRef = useRef<HTMLSpanElement>(null)
  const nextId = useRef(0)

  const letters = middle ?? randomMiddle
  const { prefix, suffix, side, index } = state
  const word = text(prefix) + letters + text(suffix)

  useEffect(() => {
    let cancelled = false
    loadWordList()
      .then((list) => {
        if (cancelled) return
        setWordList(list)
        setRandomMiddle(get3Letters(list))
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error('Failed to load the word list', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Enter checks the word. A real word scores a point and deals a new batch
  // of middle letters; anything else shakes the word.
  const submit = () => {
    if (!wordList) return
    const added = prefix.length + suffix.length > 0
    if (added && wordList.all.has(word.toLowerCase())) {
      onSolve?.(word)
      setState(EMPTY)
      setRejected(false)
      const nextLetters = middle ?? get3Letters(wordList)
      setRandomMiddle(nextLetters)
      onChange?.(nextLetters)
    } else {
      setRejected(true)
    }
  }

  const commit = (next: State) => {
    setState(next)
    setRejected(false)
    const nextWord = text(next.prefix) + letters + text(next.suffix)
    if (nextWord !== word) onChange?.(nextWord)
  }

  const edit = (at: number, count: number, insert: Tile[], nextIndex: number) => {
    const tiles = (side === 'left' ? prefix : suffix).toSpliced(at, count, ...insert)
    commit({ ...state, [side === 'left' ? 'prefix' : 'suffix']: tiles, index: nextIndex })
  }

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const typed = [...e.target.value.replace(/\s/g, '')].map((ch) => ({ id: nextId.current++, ch }))
    if (typed.length > 0) edit(index, 0, typed, index + typed.length)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const length = side === 'left' ? prefix.length : suffix.length
    let next: State

    switch (e.key) {
      case 'ArrowLeft':
        next = side === 'right' && index === 0 ? inside(state, 'left') : { ...state, index: Math.max(0, index - 1) }
        break
      case 'ArrowRight':
        next = side === 'left' && index === length ? inside(state, 'right') : { ...state, index: Math.min(length, index + 1) }
        break
      case 'Home':
        next = { ...state, side: 'left', index: 0 }
        break
      case 'End':
        next = { ...state, side: 'right', index: suffix.length }
        break
      case 'Backspace':
        e.preventDefault()
        if (index > 0) edit(index - 1, 1, [], index - 1)
        return
      case 'Enter':
        e.preventDefault()
        submit()
        return
      case 'Delete':
        e.preventDefault()
        if (index < length) edit(index, 1, [], index)
        return
      default:
        return
    }

    e.preventDefault()
    setState(next)
  }

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = middleRef.current?.getBoundingClientRect()
    if (rect) setState(inside(state, e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'))
    inputRef.current?.focus()
  }

  const caretClass = (region: 'prefix' | 'middle' | 'suffix', i: number) => {
    if (side === 'left') {
      if (index < prefix.length) return region === 'prefix' && i === index ? ' caret-before' : ''
      return region === 'middle' && i === 0 ? ' caret-before' : ''
    }
    if (index > 0) return region === 'suffix' && i === index - 1 ? ' caret-after' : ''
    return region === 'middle' && i === letters.length - 1 ? ' caret-after' : ''
  }

  const renderSide = (tiles: Tile[], region: 'prefix' | 'suffix') =>
    tiles.map((t, i) => (
      <span key={t.id} className={'wordblock-tile' + caretClass(region, i)}>
        {t.ch}
      </span>
    ))

  return (
    <div
      className={'wordblock' + (rejected ? ' wordblock-rejected' : '')}
      onMouseDown={handleMouseDown}
      onAnimationEnd={(e) => {
        if (e.animationName === 'wordblock-shake' || e.animationName === 'wordblock-flash') setRejected(false)
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        className="wordblock-input"
        value=""
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        aria-label={`Add letters to ${word}, then press Enter`}
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {renderSide(prefix, 'prefix')}
      <span ref={middleRef} className="wordblock-middle">
        {[...letters].map((ch, i) => (
          <span key={i} className={'wordblock-char' + caretClass('middle', i)}>
            {ch}
          </span>
        ))}
      </span>
      {renderSide(suffix, 'suffix')}
    </div>
  )
}
