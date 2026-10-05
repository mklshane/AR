import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ARCard } from '../ar/ARManager'

interface Props {
  card: ARCard
  onClose: () => void
}

/** How long the close animation runs before the card unmounts (matches .read-card in index.css). */
const CLOSE_MS = 260

/**
 * A tapped fruit and its speech bubble, large enough to read. It flies out of the spot that was tapped,
 * the fruit pops in, then the bubble grows from its tail; closing sends it back to that spot.
 */
export function ReadCard({ card, onClose }: Props) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'closing'>('enter')
  // The tap that opened the card is followed by a click on whatever is now under the finger (this card),
  // so ignore taps for a moment.
  const [armed, setArmed] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Measure where the stage sits so it can start (and end) at the tapped point.
  useLayoutEffect(() => {
    const r = stage.current!.getBoundingClientRect()
    setOffset({ x: card.from.x - (r.left + r.width / 2), y: card.from.y - (r.top + r.height / 2) })
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
    return () => cancelAnimationFrame(id)
  }, [card])

  useEffect(() => {
    const id = setTimeout(() => setArmed(true), 400)
    return () => clearTimeout(id)
  }, [])

  const close = () => {
    if (!armed || phase === 'closing') return
    setPhase('closing')
    setTimeout(onClose, CLOSE_MS)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Fit the box: at most 94% of the width, 72% of the height.
  const width = `min(94vw, ${72 / card.aspect}vh, 40rem)`
  const away = phase !== 'open'

  return (
    <div role="dialog" aria-modal="true" aria-label={card.alt} className="absolute inset-0 z-30">
      <button
        onClick={close}
        aria-label="Close"
        className={`read-card-backdrop absolute inset-0 bg-ink/60 backdrop-blur-sm ${away ? 'opacity-0' : 'opacity-100'}`}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={stage}
          className={`read-card relative ${phase === 'closing' ? 'is-closing' : ''}`}
          style={{
            width,
            aspectRatio: `1 / ${card.aspect}`,
            transform: away ? `translate(${offset.x}px, ${offset.y}px) scale(0.2)` : 'none',
            opacity: away ? 0 : 1,
          }}
        >
          {card.items.map((it) => (
            <div
              key={it.src}
              className={`absolute ${it.role === 'fruit' ? 'read-card-fruit' : 'read-card-bubble'} ${phase === 'enter' ? '' : 'is-in'}`}
              style={
                {
                  left: `${it.rect[0] * 100}%`,
                  top: `${(it.rect[1] / card.aspect) * 100}%`,
                  width: `${it.rect[2] * 100}%`,
                  height: `${(it.rect[3] / card.aspect) * 100}%`,
                  transformOrigin: `${it.origin[0] * 100}% ${it.origin[1] * 100}%`,
                } as CSSProperties
              }
            >
              <img
                src={it.src}
                alt={it.role === 'bubble' ? card.alt : ''}
                className="h-full w-full object-contain drop-shadow-[0_14px_22px_rgb(0_0_0/0.4)]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
