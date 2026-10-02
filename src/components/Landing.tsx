interface Props {
  onStart: () => void
  posterSrc: string
}

export function Landing({ onStart, posterSrc }: Props) {
  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-sky-deep">
      <div className="halftone pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink/40 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-xs font-medium tracking-[0.2em] text-cream/80 uppercase">
        <span>Issue 01</span>
        <span>WebAR</span>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <div className="float relative mb-10 w-[min(58vw,260px)]" style={{ ['--r' as string]: '-5deg' }}>
          <img
            src={posterSrc}
            alt="The AR poster: you seem pretty sad for a girl so in love"
            className="w-full rounded-sm shadow-[0_24px_60px_-12px_rgb(11_20_34/0.6)] ring-4 ring-cream"
          />
          <span className="absolute -right-5 -bottom-4 rotate-6 rounded-full bg-pink px-3 py-1 font-display text-sm font-black text-navy shadow-lg">
            AR inside ✦
          </span>
        </div>

        <h1 className="font-display text-[clamp(2.4rem,11vw,4rem)] leading-[0.95] font-black text-cream [text-shadow:3px_3px_0_var(--color-navy)]">
          Interactive
          <br />
          <span className="text-pink">AR</span> Magazine
        </h1>
        <p className="mt-4 font-display text-lg text-cream/90 italic">Bring the magazine to life.</p>

        <button
          onClick={onStart}
          className="mt-9 rounded-full bg-cream px-10 py-4 font-display text-lg font-black tracking-wide text-navy shadow-[4px_4px_0_var(--color-navy)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-navy)]"
        >
          START AR
        </button>
        <p className="mt-5 max-w-xs text-sm text-cream/75"></p>
      </section>

      <footer className="relative z-10 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-cream/60">
        Point your phone at the printed poster after tapping Start.
      </footer>
    </main>
  )
}
