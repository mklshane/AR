import { useEffect, useState } from 'react'

const TIPS = ['Move closer to the poster.', 'Make sure the entire poster is visible.', 'Try better lighting, and avoid glare.']

interface Props {
  /** Target was seen at least once and then lost. */
  lost: boolean
}

/** Scan frame with corner brackets and a sweeping line, plus rotating tips if nothing is found. */
export function ScanOverlay({ lost }: Props) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const tip = secs >= 8 ? TIPS[Math.floor((secs - 8) / 4) % TIPS.length] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
      <p className="pop-in mb-6 rounded-full bg-ink/55 px-4 py-2 text-sm font-medium backdrop-blur" key={String(lost)}>
        {lost ? 'Point your camera back at the poster' : 'Point your camera at the poster'}
      </p>
      <div className="relative aspect-[4/5] w-[min(72vw,340px)]" style={{ ['--sweep' as string]: 'calc(min(72vw,340px) * 1.25)' }}>
        {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
          <span key={c} className={`absolute h-10 w-10 border-cream/90 ${c}`} />
        ))}
        <div className="scan-line absolute inset-x-2 top-0 h-16 -translate-y-1/2 bg-gradient-to-b from-transparent via-scan/35 to-transparent">
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-scan shadow-[0_0_14px_2px_var(--color-scan)]" />
        </div>
      </div>
      <p className="mt-6 h-5 text-sm text-cream/85 [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]">
        {tip ?? 'Keep the poster within the frame'}
      </p>
    </div>
  )
}
