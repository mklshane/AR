import * as THREE from 'three'

export interface NoteColors {
  /** Title colour (usually the page's own headline colour). */
  title: string
  ink: string
  /** The washi tape strip, semi-transparent. */
  tape: string
}

/** A white paper tag with a strip of washi tape, like something stuck on the page: a title and a one-line hint. */
export async function noteTexture(title: string, hint: string, colors: NoteColors) {
  await Promise.all(['700 64px Montserrat', '500 31px Montserrat'].map((f) => document.fonts?.load(f).catch(() => undefined)))
  const W = 800
  const H = 236
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.shadowColor = 'rgba(70, 20, 60, 0.3)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#fffaf6'
  ctx.beginPath()
  ctx.roundRect(24, 40, W - 48, H - 70, 14)
  ctx.fill()
  ctx.restore()
  // Washi tape across the top, slightly askew, with faint stripes.
  ctx.save()
  ctx.translate(W / 2, 44)
  ctx.rotate(-0.04)
  ctx.fillStyle = colors.tape
  ctx.fillRect(-90, -22, 180, 44)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  for (let x = -84; x < 90; x += 22) ctx.fillRect(x, -22, 8, 44)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.title
  ctx.font = '700 64px Montserrat, system-ui, sans-serif'
  ctx.fillText(title, W / 2, 132)
  ctx.fillStyle = colors.ink
  ctx.font = '500 31px Montserrat, system-ui, sans-serif'
  ctx.fillText(hint, W / 2, 182)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return { map, aspect: H / W }
}
