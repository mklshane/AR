import type { SVGProps } from 'react'

/** The leaf from the LIVIN masthead. Rocks gently unless `still`, for use as a loading mark. */
export function Leaf({ still, className = '', ...props }: SVGProps<SVGSVGElement> & { still?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${still ? '' : 'rock'} ${className}`} {...props}>
      <path d="M19.5 3C10 3.5 4.5 9 5 18.5 14.5 18 20 12.5 19.5 3Z" fill="var(--color-lime)" />
      <path d="M5 18.5C8.5 13.5 12 10 16.5 6.5M4 20l1-1.5" fill="none" stroke="var(--color-forest)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
