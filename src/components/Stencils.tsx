import { useId, type CSSProperties, type ReactNode } from 'react'

/** Two shades just darker than the paper, so the leaves read like stencilled shadows. */
const LIGHT = '#efdfc2'
const DEEP = '#e7d1ac'

/** Monstera: a heart-shaped leaf with pinnate slits cut in from the edge and holes beside the midrib. */
function Monstera({ fill }: { fill: string }) {
  const id = useId()
  const rows = [52, 80, 108, 136, 162]
  return (
    <svg viewBox="0 0 200 210" className="h-full w-full">
      <mask id={id}>
        <path d="M100 28 C 120 6 176 10 192 70 C 204 124 170 184 100 200 C 30 184 -4 124 8 70 C 24 10 80 6 100 28 Z" fill="#fff" />
        {rows.map((y, i) =>
          [1, -1].map((side) => {
            // Each slit widens toward the edge and angles up, like the real leaf.
            const x0 = 100 + side * 18
            const x1 = 100 + side * 112
            const y1 = y - 34 + i * 4
            return <path key={`${y}${side}`} d={`M${x0} ${y} L${x1} ${y1 - 7} L${x1} ${y1 + 7} Z`} fill="#000" />
          }),
        )}
        {rows.slice(1, 4).map((y) =>
          [1, -1].map((side) => <ellipse key={`h${y}${side}`} cx={100 + side * 30} cy={y - 10} rx="4" ry="6.5" fill="#000" />),
        )}
        <path d="M100 30 V198" stroke="#000" strokeWidth="2.5" />
      </mask>
      <rect width="200" height="210" fill={fill} mask={`url(#${id})`} />
      <path d="M100 196 L106 210" stroke={fill} strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

/** Palm frond: a curved rachis with narrow leaflets on both sides, shorter toward the tip. */
function Frond({ fill }: { fill: string }) {
  const leaflets = []
  for (let i = 1; i < 18; i++) {
    const t = i / 18
    // Quadratic curve from (8,104) via (150,0) to (300,40)
    const x = (1 - t) ** 2 * 8 + 2 * (1 - t) * t * 150 + t * t * 300
    const y = (1 - t) ** 2 * 104 + t * t * 40
    const tx = 2 * (1 - t) * 142 + 2 * t * 150
    const ty = 2 * (1 - t) * -104 + 2 * t * 40
    const len = Math.hypot(tx, ty)
    const [ux, uy] = [tx / len, ty / len]
    const l = 70 * (1 - t * 0.7)
    for (const side of [1, -1]) {
      // Leaflets droop: angle back along the rachis and down.
      const nx = -uy * side * 0.8 - ux * 0.35
      const ny = ux * side * 0.8 - uy * 0.35 + 0.35
      leaflets.push(<path key={`${i}${side}`} d={`M${x} ${y} q${nx * l * 0.5 + 6} ${ny * l * 0.5} ${nx * l} ${ny * l}`} />)
    }
  }
  return (
    <svg viewBox="-60 -60 420 240" className="h-full w-full">
      <g fill="none" stroke={fill} strokeLinecap="round">
        <path d="M8 104 Q150 0 300 40" strokeWidth="5" />
        <g strokeWidth="8">{leaflets}</g>
      </g>
    </svg>
  )
}

/** Banana leaf: a long blade with its midrib and torn side veins left as paper. */
function Banana({ fill }: { fill: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 120 320" className="h-full w-full">
      <mask id={id}>
        <path d="M60 4 C 104 40 116 140 104 230 C 96 280 78 306 60 318 C 42 306 24 280 16 230 C 4 140 16 40 60 4 Z" fill="#fff" />
        <path d="M60 10 V318" stroke="#000" strokeWidth="3" />
        {[70, 120, 150, 200, 236].map((y) => (
          <path key={y} d={`M60 ${y} L${y % 20 ? 10 : 112} ${y - 34}`} stroke="#000" strokeWidth="2.4" />
        ))}
      </mask>
      <rect width="120" height="320" fill={fill} mask={`url(#${id})`} />
    </svg>
  )
}

function Gumamela({ fill }: { fill: string }) {
  return (
    <svg viewBox="-30 -30 60 60" className="h-full w-full">
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cy="-13" rx="10" ry="14" fill={fill} transform={`rotate(${r})`} />
      ))}
      <path d="M0 0 L14 -24" stroke="#f6ead3" strokeWidth="2" strokeLinecap="round" />
      <circle r="4" fill="#f6ead3" />
    </svg>
  )
}

function Piece({ style, sway, children }: { style: CSSProperties; sway?: string; children: ReactNode }) {
  return (
    <div className="absolute" style={style}>
      <div className={sway ? 'sway-soft h-full w-full' : 'h-full w-full'} style={sway ? { animationDelay: sway } : undefined}>
        {children}
      </div>
    </div>
  )
}

/** Leaf and flower silhouettes behind the landing page, tone-on-tone like shadows on a wall. */
export function Stencils() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Piece style={{ width: 250, height: 262, left: -100, top: 48, rotate: '24deg' }} sway="-1s">
        <Monstera fill={LIGHT} />
      </Piece>
      <Piece style={{ width: 380, height: 218, right: -200, top: 120, rotate: '196deg' }} sway="-3s">
        <Frond fill={DEEP} />
      </Piece>
      <Piece style={{ width: 120, height: 320, left: -44, bottom: '6%', rotate: '28deg' }} sway="-5s">
        <Banana fill={DEEP} />
      </Piece>
      <Piece style={{ width: 230, height: 242, right: -86, bottom: -70, rotate: '-34deg' }} sway="-2s">
        <Monstera fill={LIGHT} />
      </Piece>
      <Piece style={{ width: 320, height: 184, left: -60, bottom: 30, rotate: '-8deg' }}>
        <Frond fill={LIGHT} />
      </Piece>
      <Piece style={{ width: 52, height: 52, right: 16, top: 70, rotate: '14deg' }}>
        <Gumamela fill={DEEP} />
      </Piece>
      <Piece style={{ width: 36, height: 36, left: 22, top: 260, rotate: '-20deg' }}>
        <Gumamela fill={DEEP} />
      </Piece>
      <Piece style={{ width: 46, height: 46, right: 30, bottom: 150, rotate: '30deg' }}>
        <Gumamela fill={LIGHT} />
      </Piece>
    </div>
  )
}
