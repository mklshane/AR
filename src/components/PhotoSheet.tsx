import { useMemo } from 'react'

interface Props {
  blob: Blob
  /** Object URL for `blob`; the owner revokes it on close. */
  url: string
  onClose: () => void
}

export function PhotoSheet({ blob, url, onClose }: Props) {
  const file = useMemo(() => new File([blob], 'ar-magazine.jpg', { type: 'image/jpeg' }), [blob])
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-ink/90 p-6 backdrop-blur">
      <img src={url} alt="Your AR photo" className="pop-in max-h-[65vh] rounded-xl shadow-2xl ring-4 ring-cream" />
      <div className="flex gap-3">
        {canShare ? (
          <button onClick={() => navigator.share({ files: [file] }).catch(() => undefined)} className="rounded-full bg-cream px-6 py-3 font-bold text-navy">
            Share
          </button>
        ) : (
          <a href={url} download="ar-magazine.jpg" className="rounded-full bg-cream px-6 py-3 font-bold text-navy">
            Save photo
          </a>
        )}
        <button onClick={onClose} className="rounded-full border border-cream/30 px-6 py-3 font-bold">
          Done
        </button>
      </div>
    </div>
  )
}
