import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { experience } from './data/targets'

const fakecam = new URLSearchParams(location.search).get('fakecam')
if (import.meta.env.DEV && fakecam !== null) {
  const { installFakeCamera } = await import('./dev/fakeCamera')
  installFakeCamera(fakecam, experience.targets[0].image)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
