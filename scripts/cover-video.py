#!/usr/bin/env python3
"""
Build the animated wraparound cover: one clip, back cover | front cover side by side, each half lined up
exactly with its printed cover, used both by the AR covers (each shows its half) and by the flipbook's
full-cover view.

  1. Register each printed cover to the animation (SIFT + a similarity transform). The covers are trimmed
     separately (the spine isn't printed), so each gets its own transform.
  2. Seamless loop: the last LOOP_FADE seconds are cross-faded into the start, so the clip loops without
     a jump.
  3. Print-only extras stay on top: where the print never matches the animation (or, where nothing moves,
     rarely does)
     — the masthead's "Volume 1"/date, the QR code and tagline, the recycling bin — the print is kept.
  4. Optionally erase things the AR replaces with live cut-outs (--erase: the cover's bees, which then fly off
     it): inside each box the clip shows the print with that thing painted out, so there's no double.
  5. Encode H.264 (BT.709-tagged, faststart, no audio).

Usage:
  python3 scripts/cover-video.py ANIM.mp4 BACK.webp FRONT.webp OUT.mp4 [--crf 22] [--fade 1]

Needs opencv-python, numpy, ffmpeg.
"""
import argparse
import subprocess

import cv2
import numpy as np


def register(page: np.ndarray, frame: np.ndarray) -> np.ndarray:
    """2×3 similarity transform taking page pixels to animation-frame pixels."""
    sift = cv2.SIFT_create(12000)
    gray = lambda im: cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    kp, dp = sift.detectAndCompute(gray(page), None)
    kf, df = sift.detectAndCompute(gray(frame), None)
    good = [a for a, b in cv2.BFMatcher().knnMatch(dp, df, k=2) if a.distance < 0.7 * b.distance]
    src = np.float32([kp[m.queryIdx].pt for m in good])
    dst = np.float32([kf[m.trainIdx].pt for m in good])
    M, inliers = cv2.estimateAffinePartial2D(src, dst, ransacReprojThreshold=2.5, maxIters=8000)
    print(f'registration: {int(inliers.sum())}/{len(good)} inliers, scale {np.hypot(M[0, 0], M[1, 0]):.4f}')
    return M


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('anim')
    ap.add_argument('back')
    ap.add_argument('front')
    ap.add_argument('output')
    ap.add_argument('--crf', type=int, default=22)
    ap.add_argument('--spread', action='store_true',
                    help='one continuous picture in the animation\'s own layout (for showing the whole cover at once), '
                         'instead of the two print-aligned halves side by side (which jump at the spine, since the '
                         'covers are trimmed separately)')
    ap.add_argument('--fade', type=float, default=1.0, help='seconds of loop cross-fade')
    ap.add_argument('--diff', type=float, default=45, help='print-vs-animation difference that counts as print-only')
    ap.add_argument('--erase', action='append', default=[], metavar='SIDE:MASK.png',
                    help='paint out what this page-sized mask marks (front or back) on every frame, plus a margin for its bobbing')
    ap.add_argument('--erase-margin', type=int, default=45)
    ap.add_argument('--keep-text', action='append', default=[], metavar='SIDE:X,Y,W,H',
                    help='also keep the print\'s light text inside this box (front or back), e.g. front:30,10,160,40')
    args = ap.parse_args()

    pages = [cv2.imread(args.back), cv2.imread(args.front)]
    H, W = pages[0].shape[:2]
    cap = cv2.VideoCapture(args.anim)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    n = len(frames)
    Ms = [register(p, frames[0]) for p in pages]
    warp = lambda f, M: cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)

    # Print-only extras: pixels the animation never reproduces, plus still pixels it usually doesn't (so a
    # swaying leaf briefly matching a dark letter can't punch a hole in the text, yet moving parts stay live).
    keeps = []
    for p, M in zip(pages, Ms):
        sample = [warp(f, M).astype(np.float32) for f in frames[:: max(1, n // 30)]]
        diffs = np.stack([cv2.GaussianBlur(np.abs(p.astype(np.float32) - w).max(axis=2), (0, 0), 1.5) for w in sample])
        still = np.stack(sample).std(axis=0).max(axis=2) < 10
        m = ((diffs.min(axis=0) > args.diff) | ((np.percentile(diffs, 30, axis=0) > args.diff) & still)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        # Small print set over moving art (e.g. "Volume 1" over a swaying frond): keep its light letters.
        side = 'back' if p is pages[0] else 'front'
        for spec in args.keep_text:
            name, box = spec.split(':')
            if name != side:
                continue
            x, y, w, h = map(int, box.split(','))
            letters = (p[y:y + h, x:x + w].min(axis=2) > 200).astype(np.uint8)
            m[y:y + h, x:x + w] |= cv2.dilate(letters, np.ones((3, 3), np.uint8))
        m = cv2.dilate(m, np.ones((5, 5), np.uint8))
        keeps.append(cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None])
        print(f'print-only area: {m.mean() * 100:.1f}%')

    # Erase boxes: a clean plate (the print with the bee inpainted) shown inside a feathered box.
    plates = []
    for i, p in enumerate(pages):
        side = 'back' if i == 0 else 'front'
        hole = np.zeros((H, W), np.uint8)
        area = np.zeros((H, W), np.float32)
        for spec in args.erase:
            name, path = spec.split(':', 1)
            if name != side:
                continue
            m = (cv2.imread(path, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
            hole |= cv2.dilate(m, np.ones((17, 17), np.uint8))
            k = 2 * args.erase_margin + 1
            area = np.maximum(area, cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))).astype(np.float32))
        plate = cv2.inpaint(p, hole, 9, cv2.INPAINT_TELEA).astype(np.float32) if hole.any() else None
        plates.append((plate, cv2.GaussianBlur(area, (0, 0), 6)[..., None]))

    fade = int(round(args.fade * fps))
    length = n - fade
    Ho = H // 2 * 2
    out_w = W * 2
    if args.spread:
        # The animation's area from the back cover's left edge to the front cover's right edge.
        corners = [np.float32([[0, 0], [W, 0], [0, H], [W, H]]) @ M[:, :2].T + M[:, 2] for M in Ms]
        x0, y0 = int(np.floor(corners[0][:, 0].min())), int(np.floor(max(0, min(c[:, 1].min() for c in corners))))
        x1 = int(np.ceil(corners[1][:, 0].max()))
        y1 = int(np.ceil(min(frames[0].shape[0], max(c[:, 1].max() for c in corners))))
        sw, sh = (x1 - x0) // 2 * 2, (y1 - y0) // 2 * 2
        shift = np.float32([[1, 0, -x0], [0, 1, -y0]])
        # Each page's print and its print-only mask, carried into that layout.
        to_spread = [(np.vstack([M, [0, 0, 1]]))[:2] - np.float32([[0, 0, x0], [0, 0, y0]]) for M in Ms]
        prints = [cv2.warpAffine(p, T, (sw, sh)).astype(np.float32) for p, T in zip(pages, to_spread)]
        pkeeps = [cv2.warpAffine(k[..., 0], T, (sw, sh))[..., None] for k, T in zip(keeps, to_spread)]
        out_w, Ho = sw, sh
        print(f'spread layout: {sw}×{sh} (source x {x0}–{x1})')
    enc = subprocess.Popen(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{out_w}x{Ho}', '-r', str(fps), '-i', '-',
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(args.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
         '-movflags', '+faststart', '-an', args.output],
        stdin=subprocess.PIPE,
    )
    for i in range(length):
        f = frames[i].astype(np.float32)
        if i < fade:
            a = i / fade
            f = frames[length + i].astype(np.float32) * (1 - a) + f * a
        f = np.clip(f, 0, 255).astype(np.uint8)
        if args.spread:
            pic = cv2.warpAffine(f, shift, (out_w, Ho)).astype(np.float32)
            for pr, k in zip(prints, pkeeps):
                pic = pic * (1 - k) + pr * k
            enc.stdin.write(np.clip(pic, 0, 255).astype(np.uint8).tobytes())
            continue
        halves = []
        for p, M, keep, (plate, area) in zip(pages, Ms, keeps, plates):
            half = warp(f, M).astype(np.float32)
            half = half * (1 - keep) + p.astype(np.float32) * keep
            if plate is not None:  # last, so the print's own copy (kept as "print-only") goes too
                half = half * (1 - area) + plate * area
            halves.append(half)
        enc.stdin.write(np.clip(np.hstack(halves)[:Ho], 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f'wrote {length} frames ({length / fps:.1f} s loop) → {args.output}')


if __name__ == '__main__':
    main()
