interface Props {
  onStart: () => void
  onRead: () => void
}

/**
 * Phones get the cover itself: the illustration full-bleed, its sea running on underneath to hold the copy.
 * Wide screens get a spread built from the cover's parts: its coral sky, a hill-and-sea shoreline, and the
 * printed cover standing on it beside the copy.
 */
export function Landing(props: Props) {
  return (
    <>
      <Phone {...props} />
      <Wide {...props} />
    </>
  )
}

function Phone({ onStart, onRead }: Props) {
  return (
    <main className="cover-sea relative flex min-h-full flex-col overflow-hidden text-white md:hidden">
      <h1 className="sr-only">Living Magazine</h1>
      <img
        src="/cover-art-760.webp"
        srcSet="/cover-art-760.webp 760w, /cover-art-1200.webp 1200w"
        sizes="100vw"
        alt="The Volume I cover: villagers tending winding green hills above the sea, under the LIVIN masthead"
        width={1200}
        height={1631}
        fetchPriority="high"
        className="cover-fade h-[min(136vw,66svh)] w-full shrink-0 object-cover object-top"
      />
      <section className="cover-grain relative mt-[-10svh] flex flex-1 flex-col justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+2.25rem)]">
        <div className="relative w-full max-w-sm">
          <Kicker className="text-white/85" dot="text-path" />
          <p className="mt-2 text-[clamp(1.9rem,8.5vw,2.6rem)] leading-[1.05] font-bold [text-shadow:0_1px_14px_rgb(29_63_80/0.35)]">
            Green Living, Grounded Living
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-white/85">Have the printed magazine ready, then point your camera at the page.</p>
          <Actions onStart={onStart} onRead={onRead} className="mt-5" iconClass="text-white/65 hover:text-white" />
        </div>
      </section>
    </main>
  )
}

function Wide({ onStart, onRead }: Props) {
  return (
    <main className="cover-sky cover-grain relative hidden h-full min-h-150 overflow-hidden text-forest md:block">
      <Shore />

      <div className="relative mx-auto grid h-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(2rem,5vw,5rem)] px-[clamp(2rem,5vw,4rem)] pb-[6vh]">
        <section className="max-w-xl">
          <Kicker className="text-forest/80" dot="text-white" />
          <h1 className="mt-5 text-[clamp(3rem,5vw,4rem)] leading-[0.98] text-balance font-bold tracking-[-0.02em] text-white [text-shadow:0_2px_24px_rgb(150_60_40/0.25)]">
            Green Living, Grounded Living
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-forest/90">
            Have the printed magazine ready, then point your phone’s camera at the page.
          </p>
          <Actions onStart={onStart} onRead={onRead} className="mt-9" iconClass="text-forest/60 hover:text-forest" />
        </section>

        <figure className="relative aspect-8/11 h-[min(72vh,40rem)]">
          <img
            src="/magazine/p04.webp"
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full translate-x-[-14%] translate-y-[3%] -rotate-6 rounded-[3px] object-cover shadow-[0_24px_50px_-20px_rgb(60_30_20/0.55)]"
          />
          <img
            src="/cover-art-1200.webp"
            alt="The Volume I cover of Living Magazine"
            width={1200}
            height={1631}
            loading="lazy"
            className="absolute inset-0 h-full w-full rotate-3 rounded-[3px] object-cover object-top shadow-[0_2px_4px_rgb(60_30_20/0.2),0_40px_70px_-24px_rgb(40_30_40/0.6)]"
          />
        </figure>
      </div>
    </main>
  )
}

/** The cover's shoreline along the bottom: a rolling green hill, a white foam crest, then the sea. */
function Shore() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[30vh] w-full">
      <defs>
        <linearGradient id="shore-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb453" />
          <stop offset="1" stopColor="#5f7f37" />
        </linearGradient>
        <linearGradient id="shore-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd6e0" />
          <stop offset="0.35" stopColor="#5eaac2" />
          <stop offset="1" stopColor="#3d6f86" />
        </linearGradient>
      </defs>
      <path d="M0 120 C 220 60 420 70 640 110 C 860 150 1060 60 1260 70 C 1350 75 1410 90 1440 96 V320 H0 Z" fill="url(#shore-hill)" />
      <path d="M0 196 C 240 160 460 210 720 196 C 980 182 1180 150 1440 170 V320 H0 Z" fill="#f4fafa" />
      <path d="M0 208 C 240 172 460 222 720 208 C 980 194 1180 162 1440 182 V320 H0 Z" fill="url(#shore-sea)" />
    </svg>
  )
}

function Kicker({ className, dot }: { className: string; dot: string }) {
  return (
    <p className={`text-[11px] font-semibold tracking-[0.28em] uppercase ${className}`}>
      Living Magazine <span className={dot}>·</span> Volume I
    </p>
  )
}

interface ActionsProps extends Props {
  className: string
  iconClass: string
}

function Actions({ onStart, onRead, className, iconClass }: ActionsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={onStart}
        className="flex-1 rounded-full bg-path py-4 text-[14px] font-bold tracking-[0.14em] text-forest uppercase shadow-[0_10px_24px_-10px_rgb(20_45_60/0.7)] transition-[transform,background-color] hover:bg-white active:scale-[0.98] md:flex-none md:px-12"
      >
        Open camera
      </button>
      <button
        onClick={onRead}
        aria-label="Flip through the magazine"
        title="Flip through the magazine"
        className={`grid size-12 shrink-0 place-items-center rounded-full transition-colors active:scale-95 ${iconClass}`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 6.5C10.2 5.2 7.5 4.5 3.5 4.5v13c4 0 6.7.7 8.5 2 1.8-1.3 4.5-2 8.5-2v-13c-4 0-6.7.7-8.5 2Z" />
          <path d="M12 6.5v13" />
        </svg>
      </button>
    </div>
  )
}
