import { useEffect, useState } from 'react'
import { Sun } from './Sun'

const TIPS = ['Get a little closer.', 'Fit the whole page in the frame.', 'Find better light and avoid glare.']

interface Props {
  /** Target was seen at least once and then lost. */
  lost: boolean
  /** Camera is live but the tracker is still loading: show this step instead of scan tips. */
  preparing?: string
}

/** Scan frame with corner brackets and a sweeping line, plus rotating tips if nothing is found. */
export function ScanOverlay({ lost, preparing }: Props) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const tip = secs >= 8 ? TIPS[Math.floor((secs - 8) / 4) % TIPS.length] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      {preparing ? (
        <p className="mb-6 flex items-center gap-2 rounded-lg bg-kape/65 px-4 py-2 text-sm font-medium backdrop-blur">
          <Sun className="sun-loading h-5 w-5" />
          Getting ready…
        </p>
      ) : (
        <p className="pop-in mb-6 rounded-lg bg-kape/65 px-4 py-2 font-display text-[15px] backdrop-blur" key={String(lost)}>
          {lost ? 'Lost it. Point back at the page.' : 'Point at the page'}
        </p>
      )}
      <div className="relative aspect-[4/5] w-[min(72vw,340px)]" style={{ ['--sweep' as string]: 'calc(min(72vw,340px) * 1.25)' }}>
        {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
          <span key={c} className={`absolute h-10 w-10 border-paper ${c}`} />
        ))}
        <div className="scan-line absolute inset-x-3 top-0 h-[3px] -translate-y-1/2 rounded-full bg-mango/80" />
      </div>
      <p className="mt-6 h-5 text-sm text-paper [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]">
        {preparing ? '' : (tip ?? 'Keep the page inside the frame')}
      </p>
    </div>
  )
}
