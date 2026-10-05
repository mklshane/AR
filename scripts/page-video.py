#!/usr/bin/env python3
"""
Turn a designer's animated version of a page (its pieces moving on a plain white background) into a
page-sized AR clip, lined up with the print. Two outputs:

  --alpha        just the pieces, transparent around them: colour over alpha, stacked (the `alpha-video`
                 layout). The printed page shows through, including any printed piece the animation moved.
  --clean IMG    the pieces over IMG, a copy of the page with its printed pieces painted out: an opaque clip
                 (for the `video` type's `cover` mode) that hides the print's poses completely.

  1. Register the animation to the page (SIFT + a similarity transform, from one frame).
  2. Key out the white background: near-white pixels connected to the frame's edge, plus enclosed holes
     (e.g. inside a bag strap) only where they're pure white and bigger than a speck, so white clothes inside
     a figure stay solid. Edges are feathered and the white fringe divided back out.
  3. Write colour over alpha, or composite over the clean page; encode H.264 (no audio), page-sized.

Usage:
  python3 scripts/page-video.py ANIM.mp4 PAGE.webp OUT.mp4 (--alpha | --clean CLEAN.png) [--ref-time 3] [--crf 20]

Needs opencv-python, numpy, ffmpeg.
"""
import argparse
import subprocess

import cv2
import numpy as np


def register(frame: np.ndarray, page: np.ndarray) -> np.ndarray:
    """2×3 similarity transform taking `frame` pixels to `page` pixels."""
    sift = cv2.SIFT_create(8000)
    gray = lambda im: cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    k1, d1 = sift.detectAndCompute(gray(frame), None)
    k2, d2 = sift.detectAndCompute(gray(page), None)
    good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.7 * b.distance]
    src = np.float32([k1[m.queryIdx].pt for m in good])
    dst = np.float32([k2[m.trainIdx].pt for m in good])
    M, inliers = cv2.estimateAffinePartial2D(src, dst, ransacReprojThreshold=2.0, maxIters=5000)
    print(f'registration: {int(inliers.sum())}/{len(good)} inliers, scale {np.hypot(M[0, 0], M[1, 0]):.4f}')
    return M


def matte(frame: np.ndarray, white: int) -> tuple[np.ndarray, np.ndarray]:
    """(unpremultiplied BGR float, alpha 0..1): background = near-white region touching the border."""
    near = (frame.min(axis=2) >= white).astype(np.uint8)
    n, labels = cv2.connectedComponents(near, connectivity=4)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, border[border > 0])
    # Enclosed holes: pure background white only (clothes' highlights are never this flat and large).
    pure = (frame.min(axis=2) >= 252).astype(np.uint8) & (~bg).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(pure, connectivity=4)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 150:
            bg |= labels == i
    alpha = cv2.GaussianBlur((~bg).astype(np.float32), (0, 0), 0.8)
    f = frame.astype(np.float32)
    rgb = (f - 254 * (1 - alpha[..., None])) / np.maximum(alpha, 1 / 255)[..., None]
    return np.clip(rgb, 0, 255), alpha


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('anim')
    ap.add_argument('page')
    ap.add_argument('output')
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--alpha', action='store_true', help='pieces only: colour over alpha, stacked')
    mode.add_argument('--clean', help='opaque: pieces over this page image with its pieces painted out')
    ap.add_argument('--ref-time', type=float, default=3.0, help='seconds into the clip of the frame to register')
    ap.add_argument('--white', type=int, default=248, help='darkest channel value still counted as background')
    ap.add_argument('--crf', type=int, default=20)
    args = ap.parse_args()

    page = cv2.imread(args.page)
    clean = None if args.alpha else cv2.imread(args.clean).astype(np.float32)
    H, W = page.shape[:2]
    cap = cv2.VideoCapture(args.anim)
    fps = cap.get(cv2.CAP_PROP_FPS)
    fw, fh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    # Work at page scale: frames are first resized to the page's width.
    k = W / fw
    size = (W, int(round(fh * k)))

    cap.set(cv2.CAP_PROP_POS_MSEC, args.ref_time * 1000)
    ok, ref = cap.read()
    assert ok, 'could not read the reference frame'
    M = register(cv2.resize(ref, size, interpolation=cv2.INTER_AREA), page)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    Ho = H // 2 * 2
    enc = subprocess.Popen(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{Ho * 2 if args.alpha else Ho}', '-r', str(fps), '-i', '-',
         # Convert and tag as BT.709, so phones decode the same colours (untagged, the paper turned greenish).
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(args.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
         '-movflags', '+faststart', '-an', args.output],
        stdin=subprocess.PIPE,
    )
    n = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, size, interpolation=cv2.INTER_AREA)
        rgb, a = matte(small, args.white)
        rgb = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
        a = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)[..., None]
        if args.alpha:
            rgb[a[..., 0] <= 0] = 0  # empty colour where fully transparent (smaller file)
            out = np.vstack([rgb[:Ho], np.repeat(a[:Ho] * 255, 3, axis=2)])
        else:
            out = clean * (1 - a) + rgb * a
            out = out[:Ho]
        enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    print(f'wrote {n} frames → {args.output}')


if __name__ == '__main__':
    main()
