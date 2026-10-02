interface Props {
  onClose: () => void
  onCapture?: () => void
}

export function ARControls({ onClose, onCapture }: Props) {
  return (
    <>
      <button
        onClick={onClose}
        aria-label="Close AR"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink/50 text-xl backdrop-blur"
      >
        ✕
      </button>
      {onCapture && (
        <button
          onClick={onCapture}
          aria-label="Take photo"
          className="absolute bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-cream/90 transition active:scale-90"
        >
          <span className="h-[54px] w-[54px] rounded-full bg-cream" />
        </button>
      )}
    </>
  )
}
