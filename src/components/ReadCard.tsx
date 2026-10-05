import { useEffect, useState } from 'react'

interface Props {
  src: string
  alt: string
  onClose: () => void
}

/** A tapped speech bubble shown large enough to read; tap anywhere (or Esc) to go back to the AR. */
export function ReadCard({ src, alt, onClose }: Props) {
  // The tap that opened the card is followed by a click on whatever is now under the finger (this card),
  // so ignore taps for a moment.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), 400)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <button
      onClick={() => armed && onClose()}
      aria-label="Close"
      className="absolute inset-0 z-30 flex items-center justify-center bg-ink/60 px-4 backdrop-blur-sm"
    >
      <img
        src={src}
        alt={alt}
        className="pop-in max-h-[70vh] w-full max-w-xl object-contain drop-shadow-[0_18px_30px_rgb(0_0_0/0.45)]"
      />
    </button>
  )
}
