#!/usr/bin/env python3
"""
Page 13 ("Lola's Beauty Drawer") — turn the design team's reference render into AR assets.

The reference (design/reference/fruits-ar.mp4, 4K on pure black) shows the printed basket, six fruits
flying out, then six speech bubbles popping in. The take-off (fruits overlapping, stretching, rising from
behind the rim) can't be rebuilt from rigid sprites, so it ships as a short clip with its own alpha; from
SWAP onwards every element is rigid and ships as a sprite plus a measured motion track.

Outputs:
  public/ar/p13/takeoff.mp4     frames 0..SWAP, colour on top / alpha below (H.264, plays on iOS)
  public/ar/p13/<id>.webp       basket, fruits and bubbles (transparent)
  public/ar/p13/patch.webp      silhouette of the printed basket + fruits (white-out under the AR)
  public/ar/p13/timeline.json   sizes, per-frame poses, clip crop and the video→page mapping

Usage: python3 scripts/extract-page13.py [design/reference/fruits-ar.mp4]
Needs: opencv-python (with the bundled FFmpeg, for H.264), numpy.
"""
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'design/reference/fruits-ar.mp4')
PAGE = os.path.join(ROOT, 'public/magazine/p13.webp')
OUT = os.path.join(ROOT, 'public/ar/p13')
TIMELINE = os.path.join(OUT, 'timeline.json')

H = 0.5  # analysis runs on half-res frames; every coordinate written out is in full 4K pixels
SPRITE_SCALE = 0.75  # sprite textures relative to 4K (page maps 4K px at ~0.74, so this is ~1:1 on the page)
CLIP_SCALE = 0.5  # take-off clip resolution relative to 4K
SWAP = 72  # first frame where every fruit is rigid (ampalaya finishes its swing at ~70)

# Where each element sits in half-res frames, used only to name connected components.
FRUITS = {
    'coconut': (1197, 255),
    'ube': (706, 232),
    'calamansi': (918, 356),
    'turmeric': (647, 527),
    'papaya': (1339, 569),
    'basket': (944, 682),
    'ampalaya': (575, 857),
}
# Final centre of each speech bubble in half-res frames (they are named after the fruit they describe).
BUBBLES = {
    'coconut': (1535, 162),
    'ube': (908, 195),
    'calamansi': (1132, 392),
    'papaya': (1637, 488),
    'turmeric': (846, 548),
    'ampalaya': (773, 858),
}
# A frame where each one is fully settled and not touching a bubble.
SOURCE_FRAME = {'coconut': 72, 'ube': 100, 'calamansi': 100, 'turmeric': 100, 'papaya': 62, 'basket': 100, 'ampalaya': 150}


def alpha_of(img):
    """Soft alpha from the pure-black background (h264 noise sits at 0–6)."""
    return np.clip((img.max(axis=2).astype(np.float32) - 6) / 18, 0, 1)


def unpremultiply(img, a):
    """The render is composited over black; divide it back out so edges don't get a dark fringe."""
    out = img.astype(np.float32) / np.maximum(a, 1 / 255)[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def components(img, min_area=1000):
    m = (img.max(axis=2) > 5).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    return lab, [(i, st[i], cen[i]) for i in range(1, n) if st[i][4] >= min_area]


def warp(t, a, s, th):
    hh, ww = a.shape
    M = cv2.getRotationMatrix2D((ww / 2, hh / 2), th, s)
    cs, sn = abs(M[0, 0]), abs(M[0, 1])
    W, Hh = int(ww * cs + hh * sn) + 2, int(ww * sn + hh * cs) + 2
    M[0, 2] += W / 2 - ww / 2
    M[1, 2] += Hh / 2 - hh / 2
    return cv2.warpAffine(t, M, (W, Hh)), cv2.warpAffine(a, M, (W, Hh), flags=cv2.INTER_NEAREST)


def search(fr, t, a, cx, cy, R, scales, rots, thr=30, pen=0.0):
    """Best (score, cx, cy, s, rot) of template t/a in frame fr near (cx, cy). Score = matching pixels."""
    best = None
    P = 600
    frp = cv2.copyMakeBorder(fr, P, P, P, P, cv2.BORDER_CONSTANT)
    for s in scales:
        if s * min(a.shape) < 3:
            continue
        for th in rots:
            wt, wm = warp(t, a, s, th)
            hh, ww = wm.shape
            X0, Y0 = int(round(cx - ww / 2 - R)), int(round(cy - hh / 2 - R))
            win = frp[Y0 + P:Y0 + P + hh + 2 * R, X0 + P:X0 + P + ww + 2 * R]
            r = cv2.matchTemplate(win, wt, cv2.TM_SQDIFF, mask=wm)
            for k in np.argsort(r, axis=None)[:6]:
                yy, xx = np.unravel_index(k, r.shape)
                patch = win[yy:yy + hh, xx:xx + ww]
                mk = wm > 0
                d = np.sqrt(((patch - wt) ** 2).sum(axis=2))
                inl = (d < thr) & mk
                sc = (inl.sum() - pen * (mk.sum() - inl.sum())) / max(1, mk.sum())
                if best is None or sc > best[0]:
                    best = (float(sc), X0 + xx + ww / 2, Y0 + yy + hh / 2, float(s), float(th))
    return best


def bubble_only(rgb, sel):
    """Drop slivers of fruit stuck to a bubble's tail: keep pixels near the bubble's own two colours
    (cream fill, outline/text ink) or blends of them, then the largest piece."""
    px = rgb[sel > 0].reshape(-1, 3).astype(np.float32)
    _, _, centers = cv2.kmeans(px, 2, None, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 20, 1), 3, cv2.KMEANS_PP_CENTERS)
    c0, c1 = centers
    # distance to the segment c0–c1 (anti-aliased edges and text are blends of the two), or to black (outer edge)
    d = c1 - c0
    t = np.clip(((rgb - c0) @ d) / (d @ d), 0, 1)[..., None]
    dist = np.linalg.norm(rgb - (c0 + t * d), axis=2)
    t2 = np.clip((rgb @ c1) / (c1 @ c1), 0, 1)[..., None]  # fade of the outline into black
    dist = np.minimum(dist, np.linalg.norm(rgb - t2 * c1, axis=2))
    keep = ((dist < 45) & (sel > 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(keep)
    if n > 1:
        keep = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    ff = keep.copy()
    cv2.floodFill(ff, np.zeros((keep.shape[0] + 2, keep.shape[1] + 2), np.uint8), (0, 0), 1)
    return (keep | (ff == 0)).astype(np.uint8) & sel


def save_sprite(path, rgb, a, scale):
    rgb = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    a = cv2.resize(a, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_AREA)
    bgra = np.dstack([unpremultiply(rgb, a), (a * 255).astype(np.uint8)])
    cv2.imwrite(path, bgra, [cv2.IMWRITE_WEBP_QUALITY, 92])


def main():
    os.makedirs(OUT, exist_ok=True)
    cap = cv2.VideoCapture(VIDEO)
    fps = cap.get(cv2.CAP_PROP_FPS)
    full = []  # 4K frames are only kept for the few we need
    half = []
    keep_full = set(SOURCE_FRAME.values()) | {0}
    while True:
        ok, img = cap.read()
        if not ok:
            break
        if len(half) in keep_full:
            full.append((len(half), img))
        half.append(cv2.resize(img, None, fx=H, fy=H, interpolation=cv2.INTER_AREA))
    N = len(half)
    full = dict(full)
    full[N - 1] = img_last = None
    cap.set(cv2.CAP_PROP_POS_FRAMES, N - 1)
    _, img_last = cap.read()
    full[N - 1] = img_last
    print(f'{N} frames @ {fps:.3f} fps')

    # ---- 1. Rigid sprites (basket + fruits), each from its settled frame -------------------------
    sprites = {}
    for nm, src in SOURCE_FRAME.items():
        lab, comps = components(half[src])
        i, st, _ = min(comps, key=lambda c: np.hypot(*(c[2] - FRUITS[nm])))
        x, y, w, h, _ = st
        sel = (lab[y:y + h, x:x + w] == i).astype(np.uint8)
        # 4K mask: the half-res component, grown a little, intersected with the 4K soft alpha.
        X, Y, W, Hh = int(x / H) - 4, int(y / H) - 4, int(w / H) + 8, int(h / H) + 8
        big = cv2.resize(cv2.dilate(sel, np.ones((3, 3), np.uint8)), (int(w / H), int(h / H)), interpolation=cv2.INTER_NEAREST)
        big = cv2.copyMakeBorder(big, 4, 4, 4, 4, cv2.BORDER_CONSTANT)
        crop = full[src][Y:Y + Hh, X:X + W]
        a = alpha_of(crop) * big[:crop.shape[0], :crop.shape[1]]
        sprites[nm] = dict(
            kind='basket' if nm == 'basket' else 'fruit',
            src=src,
            rgb_h=half[src][y:y + h, x:x + w].astype(np.float32) * sel[..., None],
            mask_h=sel,
            center_h=(x + w / 2, y + h / 2),
            size=[crop.shape[1], crop.shape[0]],
        )
        save_sprite(os.path.join(OUT, f'{nm}.webp'), crop, a, SPRITE_SCALE)

    # ---- 2. Track the rigid sprites from SWAP to the end ---------------------------------------
    for nm, sp in sprites.items():
        cx, cy = sp['center_h']
        poses = {}
        # Walk outward from the source frame so each search starts next to the answer.
        for rng in (range(sp['src'], N), range(sp['src'] - 1, SWAP - 1, -1)):
            px, py, s = cx, cy, 1.0
            for f in rng:
                fr = half[f].astype(np.float32)
                # Fruits only nudge after landing (ube eases ~5px and 2%); bubbles may cover them, so keep it tight.
                scales = [v for v in (s * 0.995, s, s * 1.005) if 0.97 <= v <= 1.05]
                b = search(fr, sp['rgb_h'], sp['mask_h'], px, py, 4, scales, (0,))
                px, py, s = b[1], b[2], b[3]
                poses[f] = (px / H, py / H, s)
        sp['poses'] = [poses[f] for f in range(SWAP, N)]
        drift = np.ptp(np.array(sp['poses'])[:, :2], axis=0)
        print(f'  {nm:9s} tracked, drift {drift[0]:.1f}×{drift[1]:.1f}px, final scale {sp["poses"][-1][2]:.3f}')

    # ---- 3. Bubbles: everything in the last frame the rigid sprites don't explain --------------
    last_h = half[N - 1].astype(np.float32)
    explained = np.zeros(last_h.shape[:2], bool)
    for sp in sprites.values():
        cx, cy, s = sp['poses'][-1]
        t, a = warp(sp['rgb_h'], sp['mask_h'], s, 0)
        hh, ww = a.shape
        x, y = int(round(cx * H - ww / 2)), int(round(cy * H - hh / 2))
        M = np.float32([[1, 0, x], [0, 1, y]])
        c = cv2.warpAffine(t, M, (last_h.shape[1], last_h.shape[0]))
        m = cv2.warpAffine(a, M, (last_h.shape[1], last_h.shape[0]), flags=cv2.INTER_NEAREST) > 0
        # Allow a few px of slack: a 2–3% pose error would otherwise leave fruit edges "unexplained".
        for dx in (-4, -2, 0, 2, 4):
            for dy in (-4, -2, 0, 2, 4):
                cs, ms = np.roll(c, (dy, dx), (0, 1)), np.roll(m, (dy, dx), (0, 1))
                explained |= ms & (np.sqrt(((last_h - cs) ** 2).sum(axis=2)) < 40)
    rest = ((last_h.max(axis=2) > 8) & ~explained).astype(np.uint8)
    rest = cv2.morphologyEx(rest, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(rest)
    bubbles = {}
    for i in range(1, n):
        if st[i][4] < 3000:
            continue
        x, y, w, h, _ = st[i]
        nm = min(BUBBLES, key=lambda k: np.hypot(*(np.array(BUBBLES[k]) - cen[i])))
        if f'bubble-{nm}' in bubbles:
            raise SystemExit(f'two components matched bubble "{nm}" — check BUBBLES')
        sel = cv2.morphologyEx((lab[y:y + h, x:x + w] == i).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        sel = bubble_only(last_h[y:y + h, x:x + w], sel)
        X, Y, W, Hh = int(x / H) - 4, int(y / H) - 4, int(w / H) + 8, int(h / H) + 8
        big = cv2.resize(cv2.dilate(sel, np.ones((3, 3), np.uint8)), (int(w / H), int(h / H)), interpolation=cv2.INTER_NEAREST)
        big = cv2.copyMakeBorder(big, 4, 4, 4, 4, cv2.BORDER_CONSTANT)
        crop = img_last[Y:Y + Hh, X:X + W]
        a = alpha_of(crop) * big[:crop.shape[0], :crop.shape[1]]
        bid = f'bubble-{nm}'
        bubbles[bid] = dict(
            kind='bubble',
            rgb_h=last_h[y:y + h, x:x + w] * sel[..., None],
            mask_h=sel,
            center_h=(x + w / 2, y + h / 2),
            size=[crop.shape[1], crop.shape[0]],
        )
        save_sprite(os.path.join(OUT, f'{bid}.webp'), crop, a, SPRITE_SCALE)
    print(f'  bubbles: {sorted(bubbles)}')
    if len(bubbles) != len(BUBBLES):
        raise SystemExit(f'expected {len(BUBBLES)} bubbles')

    # ---- 4. Bubble growth: walk back from the end until each bubble vanishes -------------------
    for bid, bb in bubbles.items():
        cx, cy = bb['center_h']
        s = 1.0
        poses = {}
        for f in range(N - 1, 0, -1):
            fr = half[f].astype(np.float32)
            scales = sorted({min(1.2, s * k) for k in (0.8, 0.88, 0.94, 0.97, 1.0, 1.03)})
            b = search(fr, bb['rgb_h'], bb['mask_h'], cx, cy, int(10 + 30 * (1 - s)), scales, (0,), pen=0.5)
            if b is None or b[0] < 0.4 or b[3] < 0.15:
                break
            cx, cy, s = b[1], b[2], b[3]
            poses[f] = (cx / H, cy / H, s)
        # The last few frames are too small to match: continue the measured growth back to zero.
        f = min(poses)
        (x1, y1, s1), (x2, y2, s2) = poses[f], poses[f + 2]
        ds, dx, dy = (s2 - s1) / 2, (x2 - x1) / 2, (y2 - y1) / 2
        while s1 - ds > 0.02 and f > 1:
            f -= 1
            x1, y1, s1 = x1 - dx, y1 - dy, s1 - ds
            poses[f] = (x1, y1, s1)
        bb['start'] = f
        bb['poses'] = [poses[g] for g in range(f, N)]
        print(f'  {bid:18s} appears at frame {f} ({f / fps:.2f}s), grows over {min(k for k in poses if poses[k][2] > 0.98) - f} frames')

    # ---- 5. Take-off clip with stacked alpha ----------------------------------------------------
    # Bubble pixels that start inside the clip (papaya's starts at ~64) are cut out: the sprites own them.
    early = [bb for bb in bubbles.values() if bb['start'] <= SWAP]
    fruit_zone = np.zeros(half[0].shape[:2], np.uint8)
    for sp in sprites.values():
        cx, cy, s = sp['poses'][0]
        hh, ww = sp['mask_h'].shape
        x, y = int(round(cx * H - ww / 2)), int(round(cy * H - hh / 2))
        fruit_zone[y:y + hh, x:x + ww] |= cv2.dilate(sp['mask_h'], np.ones((7, 7), np.uint8))

    def cut_at(f):
        """Pixels of bubbles already growing at frame f (fruits stay; by then they've landed)."""
        zone = np.zeros_like(fruit_zone)
        for bb in early:
            if f < bb['start']:
                continue
            x, y = (np.array(bb['center_h']) - np.array(bb['mask_h'].shape[::-1]) / 2).astype(int)
            zone[y:y + bb['mask_h'].shape[0], x:x + bb['mask_h'].shape[1]] |= bb['mask_h']
        return (cv2.dilate(zone, np.ones((15, 15), np.uint8)) > 0) & (fruit_zone == 0)

    union = np.zeros(half[0].shape[:2], bool)
    for f in range(SWAP + 1):
        union |= (half[f].max(axis=2) > 6) & ~cut_at(f)
    ys, xs = np.where(union)
    pad = 8
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(union.shape[1], xs.max() + pad), min(union.shape[0], ys.max() + pad)
    # H.264 wants even dimensions; mobile decoders are happiest with multiples of 16.
    w, h = (x1 - x0 + 15) // 16 * 16, (y1 - y0 + 15) // 16 * 16
    k = CLIP_SCALE / H
    cw, ch = int(w * k) // 2 * 2, int(h * k) // 2 * 2
    clip_path = os.path.join(OUT, 'takeoff.mp4')
    vw = cv2.VideoWriter(clip_path, cv2.VideoWriter_fourcc(*'avc1'), fps, (cw, ch * 2))
    for f in range(SWAP + 1):
        fr = cv2.copyMakeBorder(half[f], 0, 64, 0, 64, cv2.BORDER_CONSTANT)
        fr[:union.shape[0], :union.shape[1]][cut_at(f)] = 0
        c = fr[y0:y0 + h, x0:x0 + w]
        c = cv2.resize(c, (cw, ch), interpolation=cv2.INTER_AREA)
        a = alpha_of(c)
        rgb = unpremultiply(c, a)
        rgb[a == 0] = 0
        al = cv2.cvtColor((a * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        vw.write(np.vstack([rgb, al]))
    vw.release()
    print(f'  takeoff.mp4 {cw}×{ch * 2}, {os.path.getsize(clip_path) / 1e6:.2f} MB')

    # ---- 6. Video → page mapping (SIFT on frame 0 vs the printed page) -------------------------
    page = cv2.imread(PAGE)
    f0 = full[0]
    sift = cv2.SIFT_create(8000)
    m0 = (f0.max(axis=2) > 8).astype(np.uint8) * 255
    k1, d1 = sift.detectAndCompute(cv2.cvtColor(f0, cv2.COLOR_BGR2GRAY), m0)
    k2, d2 = sift.detectAndCompute(cv2.cvtColor(page, cv2.COLOR_BGR2GRAY), None)
    good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
    p1 = np.float32([k1[m.queryIdx].pt for m in good])
    p2 = np.float32([k2[m.trainIdx].pt for m in good])
    M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=3)
    scale = float(np.hypot(M[0, 0], M[1, 0]))
    err = np.linalg.norm((np.c_[p1, np.ones(len(p1))] @ M.T - p2)[inl.ravel() > 0], axis=1)
    print(f'  page mapping: scale {scale:.4f}, {int(inl.sum())} inliers, median error {np.median(err):.2f}px')

    # ---- 7. Patch: silhouette of the printed basket + fruits, to white out under the AR ---------
    a0 = cv2.dilate((alpha_of(f0) > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8))
    ys, xs = np.where(a0)
    px0, py0, px1, py1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    patch = cv2.GaussianBlur(a0[py0:py1, px0:px1].astype(np.float32), (0, 0), 2)
    patch = cv2.resize(patch, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
    white = np.dstack([np.full(patch.shape + (3,), 255, np.uint8), (np.clip(patch, 0, 1) * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT, 'patch.webp'), white, [cv2.IMWRITE_WEBP_QUALITY, 90])

    # ---- 8. Timeline ------------------------------------------------------------------------------
    def r(v, d=1):
        return round(float(v), d)

    layers = []
    order = ['basket', 'ampalaya', 'turmeric', 'papaya', 'ube', 'calamansi', 'coconut']
    bubble_order = sorted(bubbles, key=lambda b: bubbles[b]['start'])
    for nm in order + bubble_order:
        sp = sprites.get(nm) or bubbles[nm]
        layers.append({
            'id': nm,
            'kind': sp['kind'],
            'src': f'/ar/p13/{nm}.webp',
            'size': sp['size'],
            # poses[i] is frame `from` + i; before `from` a bubble is hidden, a fruit lives in the clip
            'from': sp.get('start', SWAP),
            # [cx, cy, scale] per frame, in 4K video pixels
            'poses': [[r(cx), r(cy), r(s, 3)] for cx, cy, s in sp['poses']],
        })
    timeline = {
        'source': 'design/reference/fruits-ar.mp4 — regenerate with scripts/extract-page13.py',
        'fps': fps,
        'frames': N,
        'swap': SWAP,
        'videoSize': [int(f0.shape[1]), int(f0.shape[0])],
        # page px = videoToPage.scale * video px + videoToPage.offset (no rotation)
        'videoToPage': {'scale': r(scale, 5), 'offset': [r(M[0, 2], 2), r(M[1, 2], 2)]},
        'clip': {'src': '/ar/p13/takeoff.mp4', 'rect': [int(x0 / H), int(y0 / H), int(w / H), int(h / H)]},
        'patch': {'src': '/ar/p13/patch.webp', 'rect': [int(px0), int(py0), int(px1 - px0), int(py1 - py0)]},
        'layers': layers,
    }
    with open(TIMELINE, 'w') as fh:
        json.dump(timeline, fh, separators=(',', ':'))
    print(f'  wrote {os.path.relpath(TIMELINE, ROOT)} ({os.path.getsize(TIMELINE) / 1e3:.0f} KB)')


if __name__ == '__main__':
    main()
