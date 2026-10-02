interface Props {
  onClose: () => void
  onCapture?: () => void
}

export function ARControls({ onClose, onCapture }: Props) {
  return (
    <>
      <button
        onClick={onClose}
        aria-label="Close camera"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-kape/60 text-paper backdrop-blur"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      {onCapture && (
        <button
          onClick={onCapture}
          aria-label="Take photo"
          className="absolute bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-paper transition active:scale-90"
        >
          <span className="h-[52px] w-[52px] rounded-full bg-sili" />
        </button>
      )}
    </>
  )
}
