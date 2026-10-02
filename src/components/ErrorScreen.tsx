import type { ARErrorCode } from '../ar/ARManager'

const MESSAGES: Record<ARErrorCode, { title: string; body: string; retry: boolean }> = {
  insecure: { title: 'Secure connection needed', body: 'The camera only works on a secure (https://) page. Open the https link instead.', retry: false },
  'no-camera-api': { title: 'Browser not supported', body: 'This browser cannot open the camera. Try Safari on iPhone or Chrome on Android.', retry: false },
  'no-webgl': { title: '3D graphics unavailable', body: 'Your browser has WebGL turned off or unsupported, which AR needs. Try another browser.', retry: false },
  'camera-denied': { title: 'Camera access is required for AR', body: 'Please allow camera access and try again. If you blocked it, re-enable it in your browser’s site settings.', retry: true },
  'no-camera': { title: 'No camera found', body: 'We couldn’t find a camera on this device.', retry: true },
  'camera-busy': { title: 'Camera is busy', body: 'Another app or tab is using the camera. Close it and try again.', retry: true },
  'target-load': { title: 'Couldn’t load the magazine', body: 'Check your connection and try again.', retry: true },
  'engine-load': { title: 'Couldn’t load the AR engine', body: 'Check your connection and try again.', retry: true },
  unknown: { title: 'Something went wrong', body: 'Please try again. If it keeps happening, try another browser.', retry: true },
}

interface Props {
  code: ARErrorCode
  onRetry: () => void
  onBack: () => void
}

export function ErrorScreen({ code, onRetry, onBack }: Props) {
  const m = MESSAGES[code]
  return (
    <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink px-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pink/15 text-3xl text-pink">!</div>
      <h2 className="font-display text-2xl font-black">{m.title}</h2>
      <p className="mt-3 max-w-sm text-cream/75">{m.body}</p>
      <div className="mt-8 flex gap-3">
        {m.retry && (
          <button onClick={onRetry} className="rounded-full bg-cream px-6 py-3 font-bold text-navy">
            Try again
          </button>
        )}
        <button onClick={onBack} className="rounded-full border border-cream/30 px-6 py-3 font-bold">
          Back
        </button>
      </div>
    </div>
  )
}
