import { useEffect, useRef, useState } from 'react'
import type { ARManager } from '../ar/ARManager'

/** ?hud: live tracking readout, so phone tests can be compared with numbers instead of feel. */
export function TrackingHud({ manager }: { manager: () => ARManager | null }) {
  const [text, setText] = useState('')
  const last = useRef({ samples: 0, time: 0, frames: 0 })

  useEffect(() => {
    let frames = 0
    let raf = requestAnimationFrame(function count() {
      frames++
      raf = requestAnimationFrame(count)
    })
    const id = setInterval(() => {
      const s = manager()?.debugState()
      if (!s) return
      const pose = s.poses[0]
      const dt = s.time - last.current.time || 1
      const hz = pose ? (pose.samples - last.current.samples) / dt : 0
      const fps = (frames - last.current.frames) / dt
      last.current = { samples: pose?.samples ?? 0, time: s.time, frames }
      const n = pose?.noise
      setText(
        [
          `camera ${s.video[0]}×${s.video[1]}  render ${fps.toFixed(0)} fps`,
          pose ? `tracker ${hz.toFixed(0)} Hz` : 'tracker: no target',
          n ? `noise lat ${(n.lateral * 1000).toFixed(1)}‰  depth ${(n.depth * 1000).toFixed(0)}‰  rot ${((n.rotation * 180) / Math.PI).toFixed(2)}°` : '',
        ].join('\n'),
      )
    }, 500)
    return () => {
      clearInterval(id)
      cancelAnimationFrame(raf)
    }
  }, [manager])

  return (
    <pre className="pointer-events-none absolute top-[max(4rem,env(safe-area-inset-top))] left-3 z-30 rounded-lg bg-black/60 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-mango">
      {text}
    </pre>
  )
}
