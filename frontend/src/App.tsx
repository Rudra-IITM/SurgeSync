import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Deploy from './pages/DeployPags'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Deploy />
    </>
  )
}

export default App
