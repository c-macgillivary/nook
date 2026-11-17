import { useState } from 'react'
import nookIkon from './assets/nook icon.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

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
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => (count * 2) + 67)}
        >
          Count is {count}
        </button>
      </section>
    </>
  )
}

export default App
