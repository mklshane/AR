import { useEffect, useState } from 'react'
import { Leaf } from './Leaf'

export function LoadingScreen({ step }: { step: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-forest/92 backdrop-blur-sm">
      <Leaf className="h-16 w-16" />
      <p className="mt-5 font-display text-lg">{step || 'Loading…'}</p>
      {slow && <p className="mt-2 max-w-xs text-center text-sm text-paper/65">Still loading. Slow connection?</p>}
    </div>
  )
}
