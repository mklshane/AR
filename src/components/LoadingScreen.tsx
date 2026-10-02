import { useEffect, useState } from 'react'
import { Sun } from './Sun'

export function LoadingScreen({ step }: { step: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-kape/90 backdrop-blur-sm">
      <Sun className="sun-loading h-20 w-20" />
      <p className="mt-5 font-display text-lg">{step || 'Loading…'}</p>
      {slow && <p className="mt-2 max-w-xs text-center text-sm text-paper/65">Still loading. Slow connection?</p>}
    </div>
  )
}
