import { Stencils } from './Stencils'
import { TropicalScene } from './TropicalScene'

interface Props {
  onStart: () => void
}

export function Landing({ onStart }: Props) {
  return (
    <main className="paper-grain relative flex min-h-full flex-col overflow-hidden bg-paper text-kape">
      <Stencils />
      <div className="bunting relative shrink-0 mt-[env(safe-area-inset-top)]" />

      <div className="@container relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
        <header className="mt-1 text-center">
          <h1 className="font-script text-[clamp(3.6rem,19vw,5.5rem)] leading-[1.05] text-sili">Tropikal</h1>
        </header>

        <div className="flex flex-1 flex-col justify-center">
          <figure className="banig relative mt-4 max-h-[105cqw] min-h-[230px] flex-1 rounded-[10px] shadow-[0_2px_0_rgb(58_36_24/0.25)]">
            <TropicalScene className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-[4px]" />
          </figure>

          <div className="pt-6 text-center">
            <p className="mx-auto max-w-[19rem] text-[15px] leading-snug text-kape/85">
              Have the printed magazine ready, then point your camera at the page.
            </p>
            <button
              onClick={onStart}
              className="mt-5 w-full max-w-[19rem] rounded-xl bg-sili py-4 font-display text-xl text-paper shadow-[0_4px_0_var(--color-kape)] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-kape)]"
            >
              Open camera
            </button>
            <p className="mt-4 text-[13px] text-kape/60">Mabuhay!</p>
          </div>
        </div>
      </div>
      <div className="banig relative h-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0 shadow-[inset_0_2px_0_rgb(58_36_24/0.18)]" />
    </main>
  )
}
