import { useEffect, useRef, useState } from 'react'

/** The wraparound cover art (back | front), still: it only comes alive in AR. */
const SRC = '/ar/cover/cover-full.webp'
const ASPECT = 4753 / 3241
/** Where the spine falls across the picture (the back cover's share of the width, measured on the art). */
const SPINE = 0.4975
const FOLD_MS = 650
/** The book's page aspect and the narrowest page it shows two-up (as in Magazine.tsx), to land the fold on it. */
const PAGE_ASPECT = 720 / 990
const MIN_PAGE = 240
/** Room under the picture for the "Open" button. */
const BUTTON_ROOM = 56

interface Props {
  /** Fold the back cover over and hand over to the book, on its front cover. */
  onOpen: () => void
}

/**
 * The whole cover at once, front and back side by side as the printed magazine looks laid open face-down. Opening folds the back half over the spine onto the front, which ends centred
 * where the book's closed front cover sits, and the book takes over.
 */
export function FullCover({ onOpen }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0, cover: 0 })
  const [folding, setFolding] = useState<string | null>(null)
  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // Fit the picture to the stage in both directions.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => {
      const [W, H] = [box.clientWidth, box.clientHeight]
      const w = Math.min(W, (H - BUTTON_ROOM) * ASPECT)
      // The closed book's front cover width, as page-flip will lay it out in this same box.
      const spreadW = Math.min(W, H * PAGE_ASPECT * 2)
      const cover = spreadW / 2 >= MIN_PAGE ? spreadW / 2 : Math.min(W, H * PAGE_ASPECT)
      setSize({ w, h: w / ASPECT, cover })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  const open = () => {
    if (folding) return
    if (reduceMotion) return onOpen()
    setFolding(SRC)
    setTimeout(onOpen, FOLD_MS)
  }

  // Swipe left to open.
  const touch = useRef<{ x: number; y: number } | null>(null)

  const half = (side: 'back' | 'front', still: string) => {
    const w = side === 'back' ? SPINE : 1 - SPINE
    return (
      <div
        className="absolute top-0 h-full overflow-hidden"
        style={{
          left: side === 'back' ? 0 : `${SPINE * 100}%`,
          width: `${w * 100}%`,
          transformOrigin: side === 'back' ? 'right center' : 'left center',
          backfaceVisibility: 'hidden',
          transition: `transform ${FOLD_MS}ms cubic-bezier(0.55, 0, 0.3, 1)`,
          transform: side === 'back' && folding ? 'rotateY(180deg)' : 'none',
        }}
      >
        <img
          src={still}
          alt=""
          draggable={false}
          className="absolute top-0 h-full max-w-none"
          style={{ width: `${100 / w}%`, left: side === 'back' ? 0 : `${(-SPINE / w) * 100}%` }}
        />
      </div>
    )
  }

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current
        touch.current = null
        if (!t) return
        const dx = e.changedTouches[0].clientX - t.x
        if (dx < -40 && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - t.y)) open()
      }}
    >
      <div
        className="relative"
        style={{
          width: size.w,
          height: size.h,
          perspective: size.w * 2,
          // While folding, slide so the front cover ends centred (where the closed book sits).
          transition: `transform ${FOLD_MS}ms cubic-bezier(0.55, 0, 0.3, 1), opacity 200ms ${FOLD_MS - 200}ms`,
          // ...and grow so it lands exactly on the book's cover.
          transform: folding ? `scale(${size.cover / (size.w * (1 - SPINE))}) translateX(${-SPINE * 50}%)` : 'none',
        }}
      >
        {folding ? (
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {half('front', folding)}
            {half('back', folding)}
          </div>
        ) : (
          <button onClick={open} aria-label="Open the magazine" className="absolute inset-0 block cursor-pointer">
            <img
              src={SRC}
              alt="Livin’ Magazine, Volume 1: the full wraparound cover"
              draggable={false}
              className="h-full w-full rounded-[3px] object-cover shadow-[0_24px_48px_-16px_rgb(0_0_0/0.6)]"
            />
            {/* The spine: a soft fold shadow down the middle. */}
            <span
              className="pointer-events-none absolute inset-y-0 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(0_0_0/0.18),transparent)]"
              style={{ left: `${SPINE * 100}%` }}
            />
          </button>
        )}
      </div>
      {!folding && (
        <button
          onClick={open}
          className="shrink-0 rounded-full bg-paper px-5 py-2 text-[13px] font-semibold tracking-wide whitespace-nowrap text-forest shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)] transition-transform active:scale-95"
        >
          Open the magazine →
        </button>
      )}
    </div>
  )
}
