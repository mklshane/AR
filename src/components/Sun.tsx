import { useId, type SVGProps } from 'react'

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** Flat eight-ray sun with a checkered core, like a paper cut-out. Turns slowly unless `still`. */
export function Sun({ still, ...props }: SVGProps<SVGSVGElement> & { still?: boolean }) {
  const checker = useId()
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden="true" {...props}>
      <defs>
        <pattern id={checker} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#f2b632" />
          <rect width="4" height="4" fill="#f9d67a" />
          <rect x="4" y="4" width="4" height="4" fill="#f9d67a" />
        </pattern>
      </defs>
      <g className={still ? undefined : 'turn'}>
        {RAYS.map((r, i) => (
          <path
            key={r}
            d={i % 2 ? 'M0 -44 L7 -24 L-7 -24 Z' : 'M0 -49 L9 -24 L-9 -24 Z'}
            fill={i % 2 ? '#d8452b' : '#f2b632'}
            transform={`rotate(${r})`}
          />
        ))}
      </g>
      <circle r="24" fill="#ef8a3c" />
      <circle r="18" fill={`url(#${checker})`} />
    </svg>
  )
}
