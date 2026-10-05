import { Leaf } from './Leaf'
import type { ARErrorCode } from '../ar/ARManager'

const MESSAGES: Record<ARErrorCode, { title: string; body: string; retry: boolean }> = {
  insecure: { title: 'This link needs https', body: 'The camera only opens on a secure page. Use the https:// link instead.', retry: false },
  'no-camera-api': { title: 'This browser can’t open the camera', body: 'Try Safari on iPhone or Chrome on Android.', retry: false },
  'no-webgl': { title: 'This browser can’t draw 3D', body: 'WebGL is off or not supported here. Try another browser.', retry: false },
  'camera-denied': { title: 'Camera access is off', body: 'Allow the camera and try again. If you blocked it before, turn it back on in your browser’s site settings.', retry: true },
  'no-camera': { title: 'No camera found', body: 'This device doesn’t seem to have a camera.', retry: true },
  'camera-busy': { title: 'The camera is in use', body: 'Close the other app or tab using it, then try again.', retry: true },
  'target-load': { title: 'The pages didn’t load', body: 'Check your connection and try again.', retry: true },
  'engine-load': { title: 'The camera view didn’t load', body: 'Check your connection and try again.', retry: true },
  unknown: { title: 'Something went wrong', body: 'Try again. If it keeps happening, try another browser.', retry: true },
}

interface Props {
  code: ARErrorCode
  onRetry: () => void
  onBack: () => void
}

export function ErrorScreen({ code, onRetry, onBack }: Props) {
  const m = MESSAGES[code]
  return (
    <div role="alert" className="absolute inset-0 z-30 flex items-center justify-center bg-forest px-4">
      <div className="w-full max-w-sm rounded-2xl bg-paper px-6 pt-7 pb-6 text-center text-ink">
        <Leaf still className="mx-auto h-11 w-11" />
        <h2 className="mt-4 font-display text-[22px] leading-tight">{m.title}</h2>
        <p className="mt-2 text-[15px] leading-snug text-ink/75">{m.body}</p>
        <div className="mt-6 flex flex-col gap-2.5">
          {m.retry && (
            <button onClick={onRetry} className="rounded-full bg-forest py-3.5 text-[14px] font-semibold tracking-[0.12em] text-paper uppercase active:scale-[0.98]">
              Try again
            </button>
          )}
          <button onClick={onBack} className="rounded-full border border-forest/30 py-3 text-[14px] font-semibold tracking-[0.12em] text-forest uppercase">
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
