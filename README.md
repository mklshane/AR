# Living Magazine (AR)

Mobile WebAR for printed pages. Open the site on a phone, tap **START AR** and point the camera at the poster. The lyric words peel off the page, the stars and heart pop out in 3D, and everything stays locked to the poster as it or the phone moves. No app install.

**Stack:** React + TypeScript + Vite + Tailwind · MindAR (image tracking) · Three.js (rendering) · GLB/glTF for Blender assets · static hosting, no backend.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (desktop)
```

### Test on desktop without a printout

| URL | What it does |
| --- | --- |
| `/?ar&fakecam` | Fake camera: streams the poster moving around a "desk" |
| `/?ar&fakecam&debug` | Same, plus page outline, axes and a test cube on the target |
| `/?fakecam=still` | Fake camera, poster held still |
| `/?fakecam=denied` / `=nocamera` | Simulate permission denied / no camera |

In the console, `window.__fakecam.hidden = true` takes the poster out of frame to test the "lost" state. `[ar] target found/lost` logs show tracking events. The fake camera is dev-only and never ships in a build.

### Test on a phone

Phone browsers only allow the camera on HTTPS:

```bash
npm run dev:phone    # HTTPS + LAN, self-signed cert
```

Open the **Network** URL Vite prints (`https://<your-computer-ip>:5173`) on a phone on the same Wi-Fi and accept the certificate warning. Point it at the poster, printed or shown on another screen.

- **iPhone:** Safari (iOS 15+). Other iOS browsers use the same engine. When asked for camera access, choose Allow. If you denied it: Settings → Safari → Camera.
- **Android:** Chrome. If you denied camera access: tap the lock icon in the address bar → Permissions → Camera.

## How it works

```
camera → MindAR Controller (finds poster, estimates pose) → anchor Group matrix
                                                         → TargetScene content (children of the anchor)
```

Content is a child of the target's anchor, so it follows the page's position, rotation and scale every frame. It can also hang off the edges of the page.

```
src/
  ar/
    ARManager.ts      camera, MindAR controller, renderer, resize, taps, photo capture
    TargetManager.ts  one anchor per target, found/lost, lazy content build
    AssetManager.ts   cached lazy loaders: images, poster crops (sky keying), GLB (+Draco/Meshopt)
    content/          one builder per content type (cutout, star, heart, cloud, text, image, video, model, audio)
    coords.ts         target-image pixels → anchor space
    types.ts          config types
  scenes/TargetScene.ts  builds a target's content from config; no per-page code
  data/targets.ts        ← the only file you edit to add or change pages
  components/            Landing, CameraUI, ScanOverlay, LoadingScreen, ErrorScreen, ARControls, PhotoSheet
  dev/                   target compiler + fake camera (dev only)
public/targets/          poster.jpg + compiled targets.mind
public/models/           GLB files
```

This uses MindAR's core `Controller` directly rather than its `MindARThree` wrapper. The wrapper imports `sRGBEncoding`, which was removed from three.js in r152. `ARManager` is a port of that wrapper that works with current three.js.

`stubs/canvas` exists because mind-ar depends on the native `canvas` module, which is only needed for compiling targets in Node and doesn't build on Node 24. We compile targets in the browser, so `package.json` overrides it with an empty stub.

## Content config

Positions are **pixels on the target image** (top-left origin), so you can read them straight off the artwork in Photoshop, Figma or Preview. `lift` is height above the page as a fraction of page width. `delay` staggers the intro.

```ts
{ type: 'cutout', id: 'sad', crop: [32, 332, 272, 455], at: [152, 393], keySky: true, hole: SKY, lift: 0.11, delay: 0.36 }
{ type: 'star',   id: 'star-top', at: [593, 232], size: 118, color: PINK, halftone: true, lift: 0.12 }
{ type: 'heart',  id: 'heart', at: [627, 567], size: 150, color: NAVY, bpm: 72 }
{ type: 'model',  id: 'robot', asset: '/models/robot.glb', at: [368, 460], scale: 0.4, animation: 'Idle' }
{ type: 'video',  id: 'clip', src: '/videos/clip.mp4', at: [368, 460], width: 400 }
{ type: 'image' | 'text' | 'cloud' | 'audio', … }   // see src/ar/types.ts
```

`cutout` crops part of the page itself and lifts it off as a sticker. `keySky` removes the sky-blue background, and `hole` paints over the printed original so it looks peeled off. Tapping any item triggers its reaction, plus a confetti burst set by the target's `tapBurst`. If one item fails to load (for example a missing GLB), it is skipped and logged, and the rest of the page still works.

## Adding a magazine page

1. Put the page artwork in `public/targets/page2.jpg`. Good targets are busy and high-contrast: photos, illustrations, texture. Avoid big plain areas or repeating patterns.
2. Add a `TargetConfig` to `src/data/targets.ts` with `targetIndex: 1`, the image path, its pixel `size`, and its `content`.
3. Recompile: with `npm run dev` running, open **`/compile.html`** and click *Compile targets*. It compiles every target in `targetIndex` order and writes `public/targets/targets.mind`. (Alternative: [MindAR's hosted compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile). Upload the images in index order and save the result as `public/targets/targets.mind`.)
4. Test with `?fakecam` (it shows the first target) or on a phone.

Recompile whenever a target image changes. Content-only edits don't need a recompile.

## Flip-through magazine

The magazine icon next to "Open camera" on the landing page (or `/?magazine`) opens a page-turning reader built on [StPageFlip](https://github.com/Nodlik/StPageFlip) (`page-flip`, pinned at 2.0.7). It shows all 74 pages of the printed issue, cover to back cover. The library needs an even page count. Phones show one page at a time; wider screens show two-page spreads.

- **Pages:** listed in `src/data/magazine.ts`, served from `public/magazine/` (`p01`–`p74.webp`, plus `thumbs/`). They're exported from the print PDF, trimmed to 8×11in, by `scripts/export-magazine.sh` (needs `brew install poppler webp`). The script also writes the landing page's cover art (`public/cover-art-*.webp`). Keep the PDF in `design/living-magazine.pdf`. It's gitignored and must stay out of `public/`, or the 136MB file ships with the site. To update the issue, replace the PDF, rerun the script and change the page count in `magazine.ts`.
- **Drag patch:** `Magazine.tsx` patches page-flip's `stopMove` so a single-page drag only has to cover about 40% of the page to turn it. Without the patch, the drag has to reach the left edge of the screen. Check the patch if you upgrade `page-flip`.

## Video on a poster

Put an MP4 in `public/videos/` and add to the target's `content`:

```ts
{ type: 'video', id: 'clip', src: '/videos/clip.mp4', at: [368, 460], width: 736, lift: 0.005 }
```

`at` set to the page centre with `width` set to the page width covers the whole poster, so the poster "comes alive". A smaller width floats the clip over part of the page. Put the video first in `content` so stickers draw on top. It plays when the poster is found, pauses when it's lost, and starts muted, since browsers only autoplay muted video. Tapping it turns sound on.

Encode for phones as H.264 MP4, 720p or less, around 2–4 Mbps, with `+faststart` so it starts before fully downloading:
`ffmpeg -i in.mov -vf scale=-2:720 -c:v libx264 -crf 24 -preset slow -movflags +faststart -c:a aac -b:a 128k public/videos/clip.mp4`

## Tracking stability

`src/ar/PoseFilter.ts` replaces MindAR's smoothing, which filtered each matrix element separately and made lifted content swing and shear. It splits each tracker sample into sideways position, depth and rotation, and learns each channel's noise level live. Then:

- **Held still:** heavy smoothing, so content stays put.
- **Moving:** smoothing loosens as the raw pose moves faster than its noise, so there's no lag and no stutter.
- **Jolt:** a jump far beyond the noise, seen on two samples in a row, snaps the content back into place. One-sample glitches are ignored.

### Field-testing switches (work on the deployed site)

| Query | Effect |
| --- | --- |
| `?hud` | Live readout: camera resolution, render fps, tracker Hz, learned noise per channel |
| `?res=1080` | Ask for a 1080p camera (default 720p). More pixels on the poster means less tracking noise, at some CPU cost |
| `?pf=0.4,30,2,3,12` | Filter tuning: `minCutoff,maxCutoff,beta,noiseSigma,motionSigma`. Lower `minCutoff` is steadier when still; higher `beta` follows movement more closely |
| `?rawpose` | MindAR's original filter, for comparison |

These combine, e.g. `/?hud&res=1080`.

### Benchmarks (dev only)

The fake camera knows exactly where it drew the poster, so filters can be scored against ground truth: `?fakecam=noisy` (small and grainy, held still), `rough` (moving, small, blurred) and `jolt` (still, but jumps every 2.5 s). With the defaults, content catches up after a jolt in ~130–150 ms, roughly the raw tracker's own processing latency. MindAR's filter takes ~300 ms.

### Physical setup matters most

- Fill most of the frame with the poster. A thumbnail on a laptop screen is near the tracker's minimum size and is very noisy. Below about a quarter of the frame height, MindAR can't detect it at all.
- Printed posters beat screens, which add glare, moiré and refresh flicker. Use even, bright light.
- Content high above the page (`lift`) magnifies any tilt error, so keep important content close to the page.
- Compile targets from the highest-resolution artwork you have. The tracker can only follow detail that's in the target image.

## Blender → GLB

1. Model at real-world-ish proportions. The loader normalises size, so `scale: 0.4` means the largest side is 40% of the page width. The model stands up out of the page on its base.
2. Apply transforms: *Object → Apply → All Transforms*.
3. Animations: give each action a clear name (`Idle`, `Wave`, `Swing`) and push it to an NLA track so it exports.
4. *File → Export → glTF 2.0*: Format **glTF Binary (.glb)**, Include → *Selected Objects*, Data → Mesh ✓ *Apply Modifiers*, Animation ✓. Enable Draco compression for meshes if you like.
5. Optimise further (recommended for phones):
   ```bash
   npx @gltf-transform/cli optimize robot.glb public/models/robot.glb --compress meshopt --texture-compress webp --texture-size 1024
   ```
   Aim for under 3–5 MB per model and textures at 1024px or less.
6. Add a `{ type: 'model', asset: '/models/robot.glb', animation: 'Idle', … }` entry. A wrong clip name logs the available names in the console. Draco and Meshopt decoding are both supported. The Draco decoder loads from Google's CDN only when needed.

## Deploy

It's a static site. `npm run build` outputs `dist/`.

- **Vercel:** `npm i -g vercel && vercel` (framework: Vite), or import the repo in the dashboard.
- **Netlify / Cloudflare Pages:** build command `npm run build`, output dir `dist`.

All of these serve HTTPS, which the camera requires. Put a QR code that links to the site on the printed poster as the entry point. Tracking itself doesn't need it.

## Performance notes

- The landing page is about 70 KB gzipped. Three.js (~165 KB gz) and MindAR + TensorFlow.js (~280 KB gz) download only after START AR.
- Content builds on first detection. Crop textures are capped at 512px and pixel ratio at 2. Mostly unlit materials, no shadows.
- Everything (textures, geometry, mixers, camera tracks) is disposed when AR closes.
- Loading: while the landing page is showing, the AR view, engine and targets prefetch in idle time (skipped when Data Saver is on). Tapping START AR goes to a live camera in ~0.5 s and ready-to-scan in ~1 s, measured on a throttled CPU at 4 Mbps (previously ~3.2 s). Each page's content builds in idle time once scanning starts, so a page appears instantly the first time it's found. Set `prefetch: false` on targets with large videos or models so they download only when scanned.
- Many posters: the `.mind` file grows by roughly 400 KB (brotli) per poster at 736×920, and detection checks every target in the file. Keep a single file to roughly 10–20 posters. For a bigger magazine, split it into issues or sections, each with its own `experience` config and `.mind` file, served at its own URL.
