import { useEffect, useRef, useState } from 'react'
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js'
import { magazine } from '../data/magazine'
import { FullCover } from './FullCover'

interface Props {
  onExit: () => void
}

/** Below this page width (px) a two-page spread is too small to read, so we show one page at a time. */
const MIN_PAGE = 240
const ratio = magazine.width / magazine.height
const total = magazine.pages.length
const last = total - 1

const pageName = (i: number) => (i === 0 ? 'Front cover' : i === last ? 'Back cover' : `Page ${i}`)

export function Magazine({ onExit }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const thumbsRef = useRef<HTMLOListElement>(null)
  const [page, setPage] = useState(0)
  const [spread, setSpread] = useState(false)
  const [flipping, setFlipping] = useState(false)
  // The whole (animated) wraparound cover, shown before the book opens and after its back cover.
  const [full, setFull] = useState(true)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    // page-flip takes over (and on destroy removes) its root, so it gets an element React doesn't own.
    const root = document.createElement('div')
    stage.appendChild(root)

    // The book's height follows its width, so size the root to fit the stage in both directions.
    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      const spreadW = Math.min(w, h * ratio * 2)
      root.style.width = `${spreadW / 2 >= MIN_PAGE ? spreadW : Math.min(w, h * ratio)}px`
    }
    fit()

    const pages = magazine.pages.map((src, i) => {
      const el = document.createElement('div')
      el.className = 'magazine-page'
      const img = document.createElement('img')
      img.src = src
      img.alt = pageName(i)
      img.draggable = false
      img.loading = i < 4 ? 'eager' : 'lazy'
      img.decoding = 'async'
      el.appendChild(img)
      return el
    })

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const pf = new PageFlip(root, {
      width: magazine.width,
      height: magazine.height,
      size: 'stretch',
      minWidth: MIN_PAGE,
      maxWidth: magazine.width,
      minHeight: MIN_PAGE / ratio,
      maxHeight: magazine.height,
      showCover: true,
      usePortrait: true,
      maxShadowOpacity: 0.5,
      mobileScrollSupport: false,
      flippingTime: reduceMotion ? 250 : 800,
    })
    pf.on('init', (e) => setSpread((e.data as { mode: string }).mode === 'landscape'))
    pf.on('changeOrientation', (e) => setSpread(e.data === 'landscape'))
    pf.on('changeState', (e) => setFlipping(e.data === 'flipping'))
    pf.on('flip', (e) => setPage(e.data))
    pf.loadFromHTML(pages)
    finishDragsEarlyInPortrait(pf)
    flipRef.current = pf

    const ro = new ResizeObserver(() => {
      fit()
      pf.update()
    })
    ro.observe(stage)

    return () => {
      ro.disconnect()
      flipRef.current = null
      pf.destroy()
    }
  }, [])


  // Keep the current page's thumbnail in view.
  useEffect(() => {
    const el = thumbsRef.current?.children[full ? 0 : page + 1] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [page, full])

  const openBook = () => {
    flipRef.current?.turnToPage(0)
    setPage(0)
    setFull(false)
  }
  // Before the front cover and after the back cover is the whole cover.
  const next = () => (page >= last ? setFull(true) : flipRef.current?.flipNext())
  const prev = () => (page === 0 ? setFull(true) : flipRef.current?.flipPrev())

  const goTo = (i: number) => {
    const pf = flipRef.current
    if (full) {
      setFull(false)
      pf?.turnToPage(i)
      setPage(i)
      return
    }
    if (!pf || onPage(i)) return
    if (Math.abs(i - page) <= (spread ? 2 : 1)) pf.flip(i)
    else {
      pf.turnToPage(i)
      setPage(pf.getCurrentPageIndex())
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      else if (full) {
        if (e.key === 'ArrowRight' || e.key === 'Enter') openBook()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  // In a spread the index is the left-hand page; the covers always show alone.
  const showsPair = spread && page > 0 && page < last
  const onPage = (i: number) => i === page || (showsPair && i === page + 1)
  const label = full ? 'Full cover' : page === 0 ? 'Cover' : page === last ? 'Back cover' : showsPair ? `${page}–${page + 1}` : `${page}`
  // A closed magazine sits on one half of the spread; slide it to the middle until it opens.
  const shift = spread && !flipping ? (page === 0 ? '-25%' : page === last ? '25%' : '0%') : '0%'

  return (
    <main className="magazine-table fixed inset-0 flex flex-col overflow-hidden text-paper">
      <header className="relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2">
        <button
          onClick={onExit}
          className="justify-self-start rounded-full border border-paper/35 px-3.5 py-1.5 text-[13px] font-medium tracking-wide transition-colors hover:bg-paper/10 active:scale-95"
        >
          ← Back
        </button>
        <h1 className="text-center leading-none">
          <span className="block font-display text-[1.6rem] font-medium">Livin’</span>
          <span className="mt-0.5 block text-[8px] font-semibold pl-[0.5em] tracking-[0.5em] text-paper/70 uppercase">Magazine</span>
        </h1>
        <p
          className="justify-self-end px-1 text-[13px] font-medium tabular-nums"
          aria-live="polite"
        >
          {label}
          {!full && page > 0 && page < last && <span className="text-paper/50"> / {total - 2}</span>}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center gap-3 px-4 py-2 sm:gap-6 sm:px-6">
        <ArrowButton className="hidden sm:grid" label="Previous page" disabled={full} onClick={prev}>
          ←
        </ArrowButton>
        <div className="relative h-full min-w-0 flex-1">
          <div
            ref={stageRef}
            className="magazine absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-700 ease-out"
            style={{ transform: `translateX(${shift})`, opacity: full ? 0 : 1, pointerEvents: full ? 'none' : undefined }}
            aria-hidden={full}
          />
          {full && <FullCover onOpen={openBook} />}
        </div>
        <ArrowButton className="hidden sm:grid" label="Next page" disabled={false} onClick={full ? openBook : next}>
          →
        </ArrowButton>
      </div>

      <nav className="relative shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" aria-label="Pages">
        <ol ref={thumbsRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-[calc(50%-1.25rem)] py-3 sm:justify-center-safe sm:px-4">
          <li>
            <button
              onClick={() => setFull(true)}
              aria-label="Full cover"
              aria-current={full ? 'page' : undefined}
              className={`block w-[3.7rem] overflow-hidden rounded-[2px] bg-paper transition-[transform,box-shadow,opacity] duration-200 ${
                full
                  ? '-translate-y-1 opacity-100 shadow-[0_0_0_2px_var(--color-forest),0_0_0_4px_var(--color-lime)]'
                  : 'opacity-60 shadow-[0_2px_4px_rgb(0_0_0/0.35)] hover:opacity-100'
              }`}
            >
              <img src="/ar/cover/cover-thumb.webp" alt="" loading="lazy" draggable={false} className="aspect-[2022/1378] w-full object-cover" />
            </button>
          </li>
          {magazine.thumbs.map((src, i) => (
            <li key={src} className={i % 2 === 1 ? 'sm:ml-1.5' : undefined}>
              <button
                onClick={() => goTo(i)}
                aria-label={pageName(i)}
                aria-current={!full && onPage(i) ? 'page' : undefined}
                className={`block w-10 overflow-hidden rounded-[2px] bg-paper transition-[transform,box-shadow,opacity] duration-200 ${
                  !full && onPage(i)
                    ? '-translate-y-1 opacity-100 shadow-[0_0_0_2px_var(--color-forest),0_0_0_4px_var(--color-lime)]'
                    : 'opacity-60 shadow-[0_2px_4px_rgb(0_0_0/0.35)] hover:opacity-100'
                }`}
              >
                <img src={src} alt="" loading="lazy" draggable={false} className="aspect-[8/11] w-full" />
              </button>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-center gap-5 sm:hidden">
          <ArrowButton label="Previous page" disabled={full} onClick={prev}>
            ←
          </ArrowButton>
          <ArrowButton label="Next page" disabled={false} onClick={full ? openBook : next}>
            →
          </ArrowButton>
        </div>
      </nav>
    </main>
  )
}

interface ArrowProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: string
  className?: string
}

function ArrowButton({ label, disabled, onClick, children, className = 'grid' }: ArrowProps) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${className} h-12 w-12 shrink-0 place-items-center rounded-full bg-paper text-lg text-forest shadow-[0_6px_16px_-6px_rgb(0_0_0/0.5)] transition-[transform,opacity] hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

interface FlipInternals {
  calc: { getPosition(): { x: number; y: number }; getCorner(): 'top' | 'bottom'; getDirection(): number } | null
  getBoundsRect(): { height: number; pageWidth: number }
  animateFlippingTo(from: { x: number; y: number }, to: { x: number; y: number }, isTurned: boolean): void
  stopMove(): void
}

const FORWARD = 0

/**
 * page-flip only completes a dragged turn once the corner crosses the spine. In portrait the spine is
 * the left edge of the screen, so a thumb drag nearly always springs back; finish once it's dragged ~40% across instead.
 * Mirrors Flip.stopMove in page-flip 2.0.7 (pinned).
 */
function finishDragsEarlyInPortrait(pf: PageFlip) {
  const flip = pf.getFlipController() as FlipInternals
  flip.stopMove = function (this: FlipInternals) {
    if (this.calc === null) return
    const pos = this.calc.getPosition()
    const rect = this.getBoundsRect()
    const y = this.calc.getCorner() === 'bottom' ? rect.height : 0
    // Page coordinates run from the spine; a forward drag starts at +pageWidth, a back drag at 0.
    const portrait = pf.getOrientation() === 'portrait'
    const threshold = !portrait ? 0 : this.calc.getDirection() === FORWARD ? rect.pageWidth * 0.6 : -rect.pageWidth * 0.4
    const turned = pos.x <= threshold
    this.animateFlippingTo(pos, { x: turned ? -rect.pageWidth : rect.pageWidth, y }, turned)
  }
}
