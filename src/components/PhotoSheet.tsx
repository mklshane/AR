import { useMemo } from 'react'

const primary =
  'flex-1 rounded-xl bg-sili py-3 text-center font-display text-lg text-paper shadow-[0_3px_0_rgb(0_0_0/0.35)] active:translate-y-[2px]'

interface Props {
  blob: Blob
  /** Object URL for `blob`; the owner revokes it on close. */
  url: string
  onClose: () => void
}

export function PhotoSheet({ blob, url, onClose }: Props) {
  const file = useMemo(() => new File([blob], 'tropikal.jpg', { type: 'image/jpeg' }), [blob])
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-kape/92 p-4 backdrop-blur">
      <figure className="pop-in relative -rotate-2 bg-paper p-2.5 pb-9 shadow-[0_10px_30px_rgb(0_0_0/0.4)]">
        <img src={url} alt="Your photo" className="max-h-[62vh] max-w-[80vw]" />
        <figcaption className="absolute right-0 bottom-2 left-0 text-center font-script text-2xl text-sili">Tropikal</figcaption>
      </figure>
      <div className="flex w-full max-w-xs gap-3">
        {canShare ? (
          <button onClick={() => navigator.share({ files: [file] }).catch(() => undefined)} className={primary}>
            Share
          </button>
        ) : (
          <a href={url} download="tropikal.jpg" className={primary}>
            Save photo
          </a>
        )}
        <button onClick={onClose} className="flex-1 rounded-xl border-2 border-paper/35 py-3 font-display text-lg">
          Done
        </button>
      </div>
    </div>
  )
}
