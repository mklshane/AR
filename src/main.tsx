import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { experience } from './data/targets'

const params = new URLSearchParams(location.search)
const fakecam = params.get('fakecam')
if (import.meta.env.DEV && fakecam !== null) {
  const { installFakeCamera } = await import('./dev/fakeCamera')
  // ?target=<id> picks which page the fake camera films (default: the first).
  const target = experience.targets.find((t) => t.id === params.get('target')) ?? experience.targets[0]
  installFakeCamera(fakecam, target.image)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
