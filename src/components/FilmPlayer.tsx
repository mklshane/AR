import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FilmHandle } from '../ar/content/ContentNode'

interface Props {
  film: FilmHandle
  onClose: () => void
}

/**
 * The page's film, full screen. It's the very same <video> the AR card shows, moved into this player and
 * back, so it carries on from the same moment either way and the camera can be put down meanwhile.
 */
export function FilmPlayer({ film, onClose }: Props) {
  const slot = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useLayoutEffect(() => {
    film.enterPlayer(slot.current!)
    const id = requestAnimationFrame(() => setShown(true))
    return () => {
      cancelAnimationFrame(id)
      film.exitPlayer()
    }
  }, [film])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={film.title}
      className={`film-player absolute inset-0 z-40 flex flex-col bg-ink ${shown ? 'is-open' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <button
          onClick={onClose}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-paper/10 pr-4 pl-3 text-sm font-semibold whitespace-nowrap text-paper transition active:scale-95"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.5 4.5L7 10l5.5 5.5" />
          </svg>
          Back to the page
        </button>
        <p className="ml-auto min-w-0 truncate font-display text-base text-paper/80 italic">{film.title}</p>
      </div>
      <div ref={slot} className="film-player-stage min-h-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]" />
    </div>
  )
}
