import { useMemo } from 'react'

const primary =
  'flex-1 rounded-full bg-paper py-3 text-center text-[14px] font-semibold tracking-[0.12em] text-forest uppercase active:scale-[0.98]'

interface Props {
  blob: Blob
  /** Object URL for `blob`; the owner revokes it on close. */
  url: string
  onClose: () => void
}

export function PhotoSheet({ blob, url, onClose }: Props) {
  const file = useMemo(() => new File([blob], 'living-magazine.jpg', { type: 'image/jpeg' }), [blob])
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-forest/95 p-4 backdrop-blur">
      <figure className="pop-in relative -rotate-2 bg-paper p-2.5 pb-9 shadow-[0_10px_30px_rgb(0_0_0/0.4)]">
        <img src={url} alt="Your photo" className="max-h-[62vh] max-w-[80vw]" />
        <figcaption className="absolute right-0 bottom-2 left-0 text-center font-script text-3xl leading-none text-forest">Living</figcaption>
      </figure>
      <div className="flex w-full max-w-xs gap-3">
        {canShare ? (
          <button onClick={() => navigator.share({ files: [file] }).catch(() => undefined)} className={primary}>
            Share
          </button>
        ) : (
          <a href={url} download="living-magazine.jpg" className={primary}>
            Save photo
          </a>
        )}
        <button onClick={onClose} className="flex-1 rounded-full border border-paper/40 py-3 text-[14px] font-semibold tracking-[0.12em] uppercase">
          Done
        </button>
      </div>
    </div>
  )
}
