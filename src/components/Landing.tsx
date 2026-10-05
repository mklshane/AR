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
          <p className="mt-2 font-masthead text-[clamp(3.2rem,15vw,4.5rem)] leading-[0.92] uppercase [text-shadow:0_1px_14px_rgb(29_63_80/0.35)]">
            Living Magazine
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
    <main className="cover-sky relative hidden h-full min-h-150 overflow-hidden text-forest md:block">
      <Shore />
      <div aria-hidden="true" className="cover-speckle absolute inset-0" />
      <Bees />

      <div className="relative mx-auto grid h-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(2rem,5vw,5rem)] px-[clamp(2rem,5vw,4rem)] pb-[10vh]">
        <section className="max-w-xl">
          <Kicker className="text-forest/80" dot="text-white" />
          <h1 className="mt-4 font-masthead text-[clamp(5rem,9vw,8.5rem)] leading-[0.88] tracking-[0.01em] text-white uppercase [text-shadow:0_2px_24px_rgb(150_60_40/0.25)]">
            Living
            <br />
            Magazine
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

/**
 * The cover's shoreline along the bottom: rolling hills with the yellow path winding over them, a white foam
 * crest, then the layered sea with the cover's own milkfish swimming in it.
 */
function Shore() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[38vh]">
      <svg viewBox="0 0 1440 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="shore-hill-back" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#a3c95a" />
            <stop offset="0.6" stopColor="#6fa33f" />
            <stop offset="1" stopColor="#4f7f30" />
          </linearGradient>
          <linearGradient id="shore-hill-mid" x1="1" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#7fae45" />
            <stop offset="1" stopColor="#456e2b" />
          </linearGradient>
          <linearGradient id="shore-path" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdf0b0" />
            <stop offset="1" stopColor="#f3d861" />
          </linearGradient>
          <linearGradient id="shore-sea-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fd6e0" />
            <stop offset="1" stopColor="#74c2d0" />
          </linearGradient>
          <linearGradient id="shore-sea-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4fb0c0" />
            <stop offset="1" stopColor="#3a90aa" />
          </linearGradient>
          <linearGradient id="shore-sea-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a85a3" />
            <stop offset="1" stopColor="#2c6684" />
          </linearGradient>
        </defs>
        {/* Back hill, lit from the upper left, with the path winding down it. */}
        <path d="M0 150 C 180 96 380 88 600 124 C 820 160 1010 78 1220 86 C 1330 90 1400 104 1440 112 V400 H0 Z" fill="url(#shore-hill-back)" />
        <path d="M250 112 C 300 120 330 138 300 158 C 262 182 330 204 420 214 L 470 214 C 380 200 330 184 360 160 C 392 134 340 116 286 108 Z" fill="url(#shore-path)" />
        <path d="M1090 92 C 1060 112 1100 128 1150 140 C 1210 154 1200 176 1150 196 L 1196 196 C 1250 176 1260 150 1190 134 C 1140 122 1112 110 1122 90 Z" fill="url(#shore-path)" />
        <path d="M0 132 C 120 110 220 112 300 132 C 230 150 120 170 0 176 Z" fill="#b6d46c" opacity="0.55" />
        <path d="M780 150 C 900 120 1040 96 1180 100 C 1080 130 960 170 820 186 Z" fill="#b6d46c" opacity="0.45" />
        <path d="M560 200 C 640 150 760 140 860 150 C 800 180 700 214 600 224 Z" fill="#3f6a2a" opacity="0.35" />
        {/* Mid hill, shaded toward the sea. */}
        <path d="M0 214 C 160 178 300 172 430 196 C 560 220 700 168 860 168 C 1010 168 1110 206 1240 198 C 1340 192 1400 178 1440 172 V400 H0 Z" fill="url(#shore-hill-mid)" />
        <path d="M160 214 C 220 186 330 180 400 200 C 440 214 420 232 360 236 C 280 240 180 236 160 214 Z" fill="#8fbf52" opacity="0.7" />
        <path d="M960 200 C 1030 176 1150 178 1210 196 C 1240 208 1220 222 1160 224 C 1080 226 990 222 960 200 Z" fill="#8fbf52" opacity="0.6" />
        {/* Dark bank the sea laps against. */}
        <path d="M0 238 C 200 222 360 246 560 236 C 760 226 900 212 1080 224 C 1240 234 1360 222 1440 214 V400 H0 Z" fill="#3e5928" />
        {/* Foam crest, with lace trailing off it. */}
        <path d="M0 252 C 220 232 420 270 680 254 C 940 238 1160 226 1440 238 V400 H0 Z" fill="#f6fbfb" />
        <path d="M0 262 C 230 242 430 280 690 264 C 950 248 1170 236 1440 248 V400 H0 Z" fill="url(#shore-sea-top)" />
        <path d="M30 270 C 110 262 170 268 230 280 C 160 278 100 276 30 282 Z M300 276 C 360 270 420 276 470 286 C 410 286 360 282 300 284 Z" fill="#f6fbfb" opacity="0.7" />
        {/* The sea, in bands like the cover's: a pale shallow, a teal swell, then the deep. */}
        <path d="M0 306 C 200 286 380 320 600 306 C 820 292 1000 278 1200 292 C 1320 300 1400 296 1440 290 V400 H0 Z" fill="url(#shore-sea-mid)" />
        <path d="M640 330 C 760 312 880 316 980 326 C 1080 336 1140 318 1240 314 C 1240 340 1000 350 640 346 Z" fill="#7fb3c4" opacity="0.65" />
        <path d="M0 350 C 240 330 520 360 780 348 C 1040 336 1240 344 1440 336 V400 H0 Z" fill="url(#shore-sea-deep)" />
        {/* Seabed stones and seaweed. */}
        <path d="M0 400 C 20 372 90 364 150 380 C 190 390 210 396 220 400 Z M560 400 C 590 380 660 374 720 386 C 750 392 762 398 770 400 Z" fill="#3b3b3d" />
        <ellipse cx="96" cy="392" rx="16" ry="10" fill="#8fcfc0" />
        <path d="M600 398 C 596 372 604 352 620 336 C 612 356 610 376 614 398 Z M630 398 C 632 376 640 362 656 352 C 646 368 642 384 642 398 Z M1330 398 C 1322 370 1328 344 1346 324 C 1338 350 1336 374 1342 398 Z M1356 398 C 1360 376 1370 360 1388 348 C 1376 366 1370 382 1368 398 Z" fill="#c2b63e" />
      </svg>
      <Palm className="absolute bottom-[50%] left-[-3%] h-[36vh]" />
      <Palm className="absolute bottom-[47%] left-[4%] h-[25vh] -scale-x-100" />
      <Palm className="absolute right-[-2%] bottom-[60%] h-[32vh] -scale-x-100" />
      <Palm className="absolute right-[5%] bottom-[57%] h-[21vh]" />
      <div className="absolute bottom-[45%] left-[37%] w-[clamp(90px,8vw,140px)]">
        <span className="absolute inset-x-[4%] bottom-[-6%] h-[22%] rounded-[50%] bg-[#2f4a1f]/45" />
        <img src="/landing/carabao.webp" alt="" className="relative w-full" />
      </div>
      <img src="/landing/fish-a.webp" alt="" className="swim absolute top-[74%] left-[7%] w-[clamp(84px,7.5vw,128px)]" />
      <img src="/landing/fish-c.webp" alt="" className="swim absolute top-[85%] left-[16%] w-[clamp(72px,6.2vw,108px)] [animation-delay:-2.4s]" />
      <img src="/landing/fish-a.webp" alt="" className="swim absolute top-[79%] left-[34%] w-[clamp(64px,5.4vw,96px)] [animation-delay:-4.1s]" />
    </div>
  )
}

/** A coconut palm in the cover's dark-green silhouette style. Drawn once; flipped and scaled per use. */
function Palm({ className }: { className: string }) {
  return (
    <svg viewBox="-110 -90 220 330" className={className}>
      <path d="M-4 0 C -2 70 10 150 30 240 L 48 240 C 26 150 10 70 5 0 Z" fill="#5c4632" />
      <path d="M-3 30 L 7 30 M-1 70 L 11 70 M3 110 L 17 110 M9 150 L 24 150 M16 190 L 33 190" stroke="#3f2f22" strokeWidth="3" />
      <path d={PALM_BACK} fill="#163a22" />
      <path d={PALM_FRONT} fill="#22502c" />
      <circle cx="-4" cy="6" r="7" fill="#4b3a1e" />
      <circle cx="6" cy="8" r="6" fill="#5a4624" />
    </svg>
  )
}

/** One frond: a drooping spine with saw-tooth leaflets down both sides. */
function frond(angle: number, len: number, droop: number) {
  const a = (angle * Math.PI) / 180
  const n = 9
  const spine = (t: number) => [Math.cos(a) * len * t, Math.sin(a) * len * t + droop * len * t * t] as const
  const left: string[] = []
  const right: string[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1)
    const [x, y] = spine(t)
    const [x2, y2] = spine(t + 0.02)
    const dx = x2 - x
    const dy = y2 - y
    const d = Math.hypot(dx, dy) || 1
    const [ux, uy] = [dx / d, dy / d]
    const leaf = len * (0.34 * (1 - t) + 0.06)
    // Leaflets sweep forward and hang under gravity.
    const tip = (side: number) => [x + (ux * 0.55 - uy * side) * leaf, y + (uy * 0.55 + ux * side) * leaf + leaf * 0.35]
    const [lx, ly] = tip(1)
    const [rx, ry] = tip(-1)
    const [nx, ny] = spine(t + 0.5 / (n + 1))
    left.push(`${lx.toFixed(1)} ${ly.toFixed(1)}`, `${nx.toFixed(1)} ${ny.toFixed(1)}`)
    right.unshift(`${nx.toFixed(1)} ${ny.toFixed(1)}`, `${rx.toFixed(1)} ${ry.toFixed(1)}`)
  }
  const [ex, ey] = spine(1)
  return `M0 0 L${left.join(' L')} L${ex.toFixed(1)} ${ey.toFixed(1)} L${right.join(' L')} Z`
}

const PALM_BACK = [frond(-160, 95, 0.55), frond(-120, 85, 0.5), frond(-60, 85, 0.5), frond(-20, 95, 0.55), frond(-90, 70, 0.35)].join(' ')
const PALM_FRONT = [frond(-185, 90, 0.7), frond(-140, 92, 0.6), frond(-100, 80, 0.45), frond(-75, 82, 0.45), frond(-38, 92, 0.6), frond(5, 90, 0.7)].join(' ')

/** The cover's bees, drifting over the sky. */
function Bees() {
  return (
    <div aria-hidden="true">
      <img src="/landing/bee.webp" alt="" className="buzz absolute top-[12%] left-[38%] w-[clamp(44px,4.4vw,72px)]" />
      <img src="/landing/bee.webp" alt="" className="buzz absolute top-[26%] left-[42%] w-[clamp(20px,1.8vw,30px)] -scale-x-100 [animation-delay:-1.3s]" />
      <img src="/landing/bee.webp" alt="" className="buzz absolute top-[10%] right-[6%] w-[clamp(28px,2.6vw,42px)] [animation-delay:-2.1s]" />
    </div>
  )
}

function Kicker({ className, dot }: { className: string; dot: string }) {
  return (
    <p className={`text-[11px] font-semibold tracking-[0.28em] uppercase ${className}`}>
      Volume I <span className={dot}>·</span> October 2026
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
