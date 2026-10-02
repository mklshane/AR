import { useEffect, useState } from 'react'

export function LoadingScreen({ step }: { step: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/85 backdrop-blur-sm">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-cream/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-pink" />
      </div>
      <p className="mt-5 font-display text-lg">{step || 'Loading…'}</p>
      {slow && <p className="mt-2 max-w-xs text-center text-sm text-cream/60">This is taking a while. A slow connection? Hang tight.</p>}
    </div>
  )
}
