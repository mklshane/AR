import { useEffect, useState } from 'react'
import { Leaf } from './Leaf'

const TIPS = ['Get a little closer.', 'Fit the whole page on screen.', 'Find better light and avoid glare.']

interface Props {
  /** Camera is live but the tracker is still loading: show this step instead of scan tips. */
  preparing?: string
}

/** A "Point at the page" prompt, plus rotating tips if nothing is found. */
export function ScanOverlay({ preparing }: Props) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const tip = secs >= 8 ? TIPS[Math.floor((secs - 8) / 4) % TIPS.length] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      {preparing ? (
        <p className="mb-6 flex items-center gap-2 rounded-full bg-ink/60 px-4 py-2 text-sm font-medium backdrop-blur">
          <Leaf className="h-5 w-5" />
          Getting ready…
        </p>
      ) : (
        <p className="pop-in mb-6 rounded-full bg-ink/60 px-4 py-2 font-display text-[15px] backdrop-blur">Point at the page</p>
      )}
      <p className="h-5 text-sm text-paper [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]">{preparing ? '' : tip}</p>
    </div>
  )
}
