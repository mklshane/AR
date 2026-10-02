import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Rect } from './types'

const MAX_CROP_PX = 512

/** Lazy, cached loaders. Nothing loads until a target is first found. */
export class AssetManager {
  private images = new Map<string, Promise<HTMLImageElement>>()
  private textures = new Map<string, Promise<THREE.Texture>>()
  private gltfs = new Map<string, Promise<GLTF>>()
  private gltfLoader?: Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader>
  private owned: THREE.Texture[] = []

  image(src: string): Promise<HTMLImageElement> {
    let p = this.images.get(src)
    if (!p) {
      p = new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new AssetError(`Could not load image ${src}`))
        img.src = src
      })
      this.images.set(src, p)
    }
    return p
  }

  texture(src: string): Promise<THREE.Texture> {
    let p = this.textures.get(src)
    if (!p) {
      p = this.image(src).then((img) => this.track(new THREE.Texture(img)))
      this.textures.set(src, p)
    }
    return p
  }

  /** A crop of an image as a texture, optionally with its sky-blue background keyed out. */
  async crop(src: string, rect: Rect, keySky = false, silhouette = false): Promise<THREE.Texture> {
    const key = `${src}#${rect.join(',')}#${keySky}#${silhouette}`
    let p = this.textures.get(key)
    if (!p) {
      p = this.image(src).then((img) => {
        const [x0, y0, x1, y1] = rect
        const w = x1 - x0
        const h = y1 - y0
        const s = Math.min(1, MAX_CROP_PX / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * s)
        canvas.height = Math.round(h * s)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(img, x0, y0, w, h, 0, 0, canvas.width, canvas.height)
        if (keySky) keySkyBlue(ctx, canvas.width, canvas.height)
        if (silhouette) {
          // Keep alpha, paint white, so a material colour can tint the shape flat (holes, shadows).
          ctx.globalCompositeOperation = 'source-in'
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        return this.track(new THREE.CanvasTexture(canvas))
      })
      this.textures.set(key, p)
    }
    return p
  }

  /** Procedurally drawn texture (halftone, clouds, text…), cached by key. */
  canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    let p = this.textures.get(key)
    if (!p) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      draw(canvas.getContext('2d')!)
      p = Promise.resolve(this.track(new THREE.CanvasTexture(canvas)))
      this.textures.set(key, p)
    }
    return p
  }

  /** GLB/glTF with Draco + Meshopt support. The loader code itself is only fetched when needed. */
  gltf(src: string): Promise<GLTF> {
    let p = this.gltfs.get(src)
    if (!p) {
      p = this.loader().then((l) =>
        l.loadAsync(src).catch(() => {
          throw new AssetError(`Could not load 3D model ${src}`)
        }),
      )
      this.gltfs.set(src, p)
    }
    return p
  }

  private loader() {
    this.gltfLoader ??= (async () => {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ])
      const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
      return new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
    })()
    return this.gltfLoader
  }

  private track<T extends THREE.Texture>(t: T): T {
    t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    this.owned.push(t)
    return t
  }

  dispose() {
    this.owned.forEach((t) => t.dispose())
    this.owned = []
    this.textures.clear()
    this.gltfs.clear()
  }
}

export class AssetError extends Error {}

/**
 * Makes sky-blue pixels transparent (soft edge) while keeping pink, cream and navy artwork.
 * Sky is bright with blue well above red; navy is also blue-dominant but dark, so luminance separates it.
 */
function keySkyBlue(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const lum = (r + g + b) / 3
    const blueness = b - r
    if (lum > 110 && blueness > 35) {
      px[i + 3] = blueness >= 50 ? 0 : Math.round((255 * (50 - blueness)) / 15)
    }
  }
  ctx.putImageData(data, 0, 0)
}
