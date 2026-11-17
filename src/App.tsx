import { useState } from 'react'
import nookIkon from './assets/nook icon.png'
import './App.css'
import WordBlock from './wordblock.tsx'

function App() {
  const [score, setScore] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
        </div>
        <div>
          <img src={nookIkon} alt="logo" style={{width: '300px', height: '200px', objectFit: 'cover'}}></img>
          <h1>Nook</h1>
          <p>
            the coziest games. duh.
          </p>
        </div>
        <p className="score" aria-live="polite">Score: {score}</p>
        <WordBlock onSolve={() => setScore((score) => score + 1)} />
      </section>
    </>
  )
}

export default App
