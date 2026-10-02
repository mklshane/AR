import { Sun } from './Sun'

/** A palm frond: a curved leaf from the crown, with cut notches along one side. */
function Frond({ d, fill = '#2f6b3a' }: { d: string; fill?: string }) {
  return <path d={d} fill={fill} />
}

/**
 * Cover illustration for the landing page, drawn as flat paper layers:
 * sky and sun, a Mayon-style volcano, hills with a bahay kubo, the sea with a bangka and a pawikan,
 * and a beach with palms and gumamela in front.
 */
export function TropicalScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMax meet" className={className} role="img" aria-label="An island morning: a volcano, a nipa hut on the hill, a boat on the sea and palm trees on the beach">
      {/* Sky in two bands. Layers run past the viewBox so taller frames show more sky instead of bars. */}
      <rect x="-300" y="-500" width="1000" height="820" fill="#f5d29c" />
      <rect x="-300" y="150" width="1000" height="100" fill="#f8e2b8" />

      {/* Birds, high up */}
      <g fill="none" stroke="#3a2418" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M96 -6 q5 -5 10 0 q5 -5 10 0" />
        <path d="M122 -24 q4 -4 8 0 q4 -4 8 0" />
        <path d="M300 -60 q4 -4 8 0 q4 -4 8 0" />
      </g>

      <Sun x="236" y="22" width="128" height="128" />

      {/* Clouds */}
      <g className="drift" fill="#fbf1de">
        <path d="M30 70 q8-16 26-10 q10-14 28-4 q16-2 16 14 Z" />
        <path d="M200 112 q6-12 20-8 q8-10 22-2 q12 0 12 10 Z" />
        <path d="M250 -30 q8-16 26-10 q10-14 28-4 q16-2 16 14 Z" />
      </g>

      {/* Volcano: a near-perfect cone, darker ridges running down from the crater */}
      <path d="M-10 238 C 60 214 112 150 140 86 Q 150 78 160 86 C 188 150 240 214 310 238 Z" fill="#7d8c62" />
      <path d="M140 86 Q 150 78 160 86 C 166 100 172 112 178 124 L 168 120 L 158 128 L 150 118 L 140 128 L 132 120 L 122 124 C 128 112 134 100 140 86 Z" fill="#9aa29a" />
      <g fill="none" stroke="#5f7048" strokeWidth="2" strokeLinecap="round">
        <path d="M146 96 C 140 140 118 190 84 226" />
        <path d="M154 96 C 162 140 186 186 226 226" />
        <path d="M150 100 C 150 150 146 196 140 232" />
      </g>
      {/* Smoke */}
      <g className="drift" fill="#fbf1de" opacity="0.9">
        <circle cx="152" cy="72" r="7" />
        <circle cx="162" cy="60" r="9" />
        <circle cx="176" cy="50" r="11" />
      </g>

      {/* Hills */}
      <path d="M-300 250 L -10 250 C 50 222 120 228 190 244 C 250 224 330 212 410 228 L 700 228 L 700 270 L -300 270 Z" fill="#4f8a45" />
      <path d="M232 258 C 270 232 330 222 410 230 L 700 230 L 700 272 L 232 272 Z" fill="#2f6b3a" />

      {/* Bahay kubo on the hill */}
      <g transform="translate(318 196)">
        <g stroke="#5a3a1c" strokeWidth="2.5">
          <path d="M4 26 V40" />
          <path d="M18 26 V40" />
          <path d="M34 26 V40" />
        </g>
        <rect x="0" y="12" width="38" height="16" fill="#d9a55b" />
        <path d="M0 16 H38 M0 20 H38 M0 24 H38" stroke="#b07e3c" strokeWidth="1" />
        <rect x="14" y="15" width="10" height="9" fill="#5a3a1c" />
        <path d="M-7 14 L19 -10 L45 14 Z" fill="#8c5a2b" />
        <path d="M-7 14 L19 -10 L45 14" fill="none" stroke="#6b4220" strokeWidth="2" strokeLinejoin="round" />
      </g>

      {/* Sea */}
      <rect x="-300" y="252" width="1000" height="70" fill="#2f8f9d" />
      <rect x="-300" y="252" width="1000" height="6" fill="#5fb3b5" />
      <g fill="none" stroke="#bfe3dc" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        <path d="M210 272 q6-4 12 0 q6 4 12 0" />
        <path d="M300 290 q6-4 12 0 q6 4 12 0" />
        <path d="M250 306 q6-4 12 0 q6 4 12 0" />
        <path d="M360 270 q6-4 12 0 q6 4 12 0" />
      </g>

      {/* Bangka with outriggers */}
      <g transform="translate(222 262)">
        <path d="M18 6 L22 -26 L40 4 Z" fill="#f2b632" />
        <path d="M20 6 V-28" stroke="#5a3a1c" strokeWidth="1.6" />
        <path d="M-14 10 L80 10" stroke="#5a3a1c" strokeWidth="1.6" />
        <path d="M0 6 Q32 16 62 6 L58 13 Q32 20 4 13 Z" fill="#d8452b" />
        <path d="M-18 12 h10 M74 12 h10" stroke="#f6ead3" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* Pawikan */}
      <g transform="translate(330 300) rotate(-14)">
        <ellipse rx="13" ry="9" fill="#6e8f4e" />
        <path d="M-6 -4 l6 -3 l6 3 l0 6 l-6 3 l-6 -3 Z" fill="none" stroke="#4f6e38" strokeWidth="1.2" />
        <circle cx="16" cy="0" r="4.5" fill="#86a865" />
        <path d="M6 -7 l8 -7 M6 7 l8 7 M-8 -6 l-6 -4 M-8 6 l-6 4" stroke="#86a865" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Beach */}
      <path d="M-300 276 L -10 276 C 50 268 120 286 186 330 L -300 330 Z" fill="#f2d6a2" />

      {/* Palms */}
      <g className="sway">
        <path d="M58 326 C 56 270 64 210 92 156" fill="none" stroke="#8c5a2b" strokeWidth="8" strokeLinecap="round" />
        <path d="M60 300 h6 M60 276 h7 M62 252 h7 M66 228 h7 M72 204 h7 M80 182 h7" stroke="#6b4220" strokeWidth="2" strokeLinecap="round" />
        <g transform="translate(92 156)">
          <Frond d="M0 0 C 20 -24 52 -26 76 -8 C 56 -14 40 -10 30 -4 C 22 -8 10 -6 0 0 Z" />
          <Frond d="M0 0 C 26 -2 52 14 64 40 C 50 26 36 22 24 20 C 18 12 8 6 0 0 Z" fill="#3f7d3f" />
          <Frond d="M0 0 C -14 -26 -44 -34 -70 -20 C -50 -20 -36 -12 -28 -6 C -18 -8 -8 -4 0 0 Z" fill="#3f7d3f" />
          <Frond d="M0 0 C -24 4 -48 22 -56 48 C -44 34 -30 28 -20 24 C -14 16 -6 8 0 0 Z" />
          <Frond d="M0 0 C 2 -22 16 -42 36 -52 C 26 -38 20 -24 18 -14 C 10 -10 4 -4 0 0 Z" fill="#4f8a45" />
          <circle cx="-2" cy="6" r="5" fill="#8c5a2b" />
          <circle cx="6" cy="8" r="5" fill="#6b4220" />
        </g>
      </g>
      <g className="sway" style={{ animationDelay: '-2.5s' }}>
        <path d="M14 330 C 18 290 10 250 -6 214" fill="none" stroke="#8c5a2b" strokeWidth="7" strokeLinecap="round" />
        <g transform="translate(-6 214)">
          <Frond d="M0 0 C 18 -20 44 -20 62 -4 C 46 -8 32 -4 24 0 C 16 -4 8 -2 0 0 Z" fill="#3f7d3f" />
          <Frond d="M0 0 C 22 2 42 18 48 42 C 38 28 26 24 16 22 C 12 14 6 6 0 0 Z" />
        </g>
      </g>

      {/* Banana leaf over the bottom-right corner */}
      <g className="sway" style={{ animationDelay: '-4s', animationDuration: '7s' }}>
        <path d="M410 330 C 380 300 352 262 356 218 C 384 238 408 276 418 316 Z" fill="#2f6b3a" />
        <path d="M410 326 C 386 296 366 262 358 222" fill="none" stroke="#bcd8a0" strokeWidth="1.8" />
        <path d="M398 312 l-22 -2 M388 296 l-22 -6 M378 278 l-18 -8 M370 260 l-12 -10" stroke="#24552e" strokeWidth="1.4" />
      </g>

      {/* Gumamela on the sand */}
      <g transform="translate(124 300)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cy="-8" rx="6.5" ry="9" fill="#d8452b" transform={`rotate(${r})`} />
        ))}
        <circle r="3.5" fill="#f2b632" />
        <path d="M0 0 l8 -12" stroke="#f2b632" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g transform="translate(100 314) scale(0.7)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cy="-8" rx="6.5" ry="9" fill="#e8578a" transform={`rotate(${r})`} />
        ))}
        <circle r="3.5" fill="#f2b632" />
      </g>
    </svg>
  )
}
