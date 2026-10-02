import type { ExperienceConfig, TargetConfig } from '../ar/types'

const PINK = '#f2b8c6'
const ROSE = '#ee9fb4'
const NAVY = '#1f3b5c'
const CREAM = '#fdf3e7'
/** Median sky colour of the poster; used to patch where a word was "peeled" off. */
const SKY = '#61849b'

/**
 * "you seem pretty sad for a girl so in love" poster — 736×920.
 * All coordinates are pixels on /targets/poster.jpg. Items outside 0..736 / 0..920 overhang the page.
 */
const poster: TargetConfig = {
  id: 'poster',
  targetIndex: 0,
  title: 'you seem pretty sad for a girl so in love',
  image: '/targets/poster.jpg',
  size: [736, 920],
  tapBurst: { colors: [PINK, ROSE, CREAM, NAVY] },
  content: [
    // Clouds first so they sit beneath the stickers.
    { type: 'cloud', id: 'cloud-left', at: [95, 430], size: 250, lift: 0.018, drift: 18 },
    { type: 'cloud', id: 'cloud-right', at: [650, 700], size: 270, lift: 0.024, drift: 22, delay: 0.2 },
    { type: 'cloud', id: 'cloud-overhang', at: [800, 360], size: 220, lift: 0.054, drift: 30, delay: 0.6 },

    // Lyric words peel up off the page one after another.
    { type: 'cutout', id: 'you', crop: [68, 50, 232, 128], at: [150, 89], keySky: true, hole: SKY, lift: 0.036, delay: 0.0 },
    { type: 'cutout', id: 'seem', crop: [62, 122, 315, 218], at: [188, 170], keySky: true, hole: SKY, lift: 0.054, delay: 0.12 },
    { type: 'cutout', id: 'pretty', crop: [52, 222, 292, 332], at: [172, 277], keySky: true, hole: SKY, lift: 0.042, delay: 0.24 },
    { type: 'cutout', id: 'sad', crop: [32, 332, 272, 455], at: [152, 393], keySky: true, hole: SKY, lift: 0.066, delay: 0.36 },
    { type: 'cutout', id: 'for-a', crop: [62, 468, 238, 548], at: [150, 508], keySky: true, hole: SKY, lift: 0.036, delay: 0.48 },
    { type: 'cutout', id: 'girl', crop: [82, 552, 278, 690], at: [180, 621], keySky: true, hole: SKY, lift: 0.06, delay: 0.6 },
    { type: 'cutout', id: 'so', crop: [205, 680, 302, 752], at: [253, 716], keySky: true, hole: SKY, lift: 0.048, delay: 0.72 },
    { type: 'cutout', id: 'in-love', crop: [292, 760, 718, 908], at: [505, 834], keySky: true, hole: SKY, lift: 0.084, delay: 0.9, wobble: 1.5 },

    // Stars: the two big halftone stars become 3D, small dark ones sparkle, extras orbit off-page.
    { type: 'star', id: 'star-top', at: [593, 232], size: 118, color: PINK, halftone: true, lift: 0.072, delay: 0.3, rotation: -6, spin: 0.03 },
    { type: 'star', id: 'star-bottom', at: [88, 763], size: 92, color: PINK, halftone: true, lift: 0.06, delay: 0.5, rotation: 8, spin: -0.04 },
    { type: 'star', id: 'sparkle-1', at: [520, 442], size: 26, color: NAVY, lift: 0.096, delay: 0.7, spin: 0.5 },
    { type: 'star', id: 'sparkle-2', at: [186, 783], size: 24, color: NAVY, lift: 0.078, delay: 0.8, spin: -0.4 },
    { type: 'star', id: 'off-top-right', at: [800, 110], size: 42, color: ROSE, halftone: true, lift: 0.132, delay: 1.1, spin: 0.2 },
    { type: 'star', id: 'off-left', at: [-70, 300], size: 34, color: PINK, lift: 0.108, delay: 1.2, spin: -0.25 },
    { type: 'star', id: 'off-top', at: [420, -60], size: 26, color: NAVY, lift: 0.09, delay: 1.3, spin: 0.4 },
    { type: 'star', id: 'off-bottom-left', at: [-50, 960], size: 30, color: NAVY, lift: 0.096, delay: 1.4, spin: -0.35 },

    // The hand-drawn heart beats; a second pink heart floats off the right edge.
    { type: 'heart', id: 'heart', at: [627, 567], size: 150, color: NAVY, lift: 0.072, delay: 0.8, bpm: 72 },
    { type: 'heart', id: 'heart-off', at: [820, 620], size: 70, color: ROSE, lift: 0.132, delay: 1.3, bpm: 90 },

    { type: 'text', id: 'hint', text: 'tap the heart', at: [368, 990], size: 26, color: CREAM, background: NAVY, lift: 0.03, delay: 1.8 },

    // Video on the poster: put an MP4 (H.264) in public/videos/ and uncomment. width 736 + at the centre
    // covers the whole page; smaller widths float a clip over part of it. Plays muted; tap it for sound.
    // { type: 'video', id: 'clip', src: '/videos/clip.mp4', at: [368, 460], width: 736, lift: 0.005 },

    // Drop a Blender export in public/models/ and uncomment (see README → "Blender → GLB").
    // { type: 'model', id: 'swing-girl', asset: '/models/swing.glb', at: [400, 450], scale: 0.4, lift: 0.03, animation: 'Swing' },

    // Optional soundtrack — use audio you have rights to.
    // { type: 'audio', id: 'music', src: '/audio/track.mp3', loop: true, volume: 0.7 },
  ],
}

export const experience: ExperienceConfig = {
  mindFile: '/targets/targets.mind',
  targets: [poster],
}
