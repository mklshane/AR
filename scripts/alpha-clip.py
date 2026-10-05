#!/usr/bin/env python3
"""
Turn a designer's render on a plain white or black background into an AR clip with transparency.

The render is treated as artwork composited over the background, and un-composited: each pixel gets the
smallest alpha that explains it (dark leaves on white → opaque; a leaf fading in → partly transparent), and
its colour is divided back out so edges carry no white/black fringe. The result is written as H.264 with
the colour on top and the alpha (grey) below — the stacked-alpha layout `alpha-video` content plays, and
the only transparent-video format every phone browser (iOS Safari included) decodes.

Usage:
  python3 scripts/alpha-clip.py IN.mp4 OUT.mp4 --key white [--width 720] [--fps 30] [--crf 24]

Needs: opencv-python, numpy, ffmpeg on PATH.
"""
import argparse
import subprocess

import cv2
import numpy as np


def uncomposite(frame: np.ndarray, key: str, soft: float) -> tuple[np.ndarray, np.ndarray]:
    """BGR uint8 → (unpremultiplied BGR uint8, alpha 0..1)."""
    f = frame.astype(np.float32)
    if key == 'white':
        # Distance from white by the darkest channel; a few levels of slack for compression noise.
        a = np.clip((255 - f.min(axis=2) - 3) / soft, 0, 1)
        rgb = (f - 255 * (1 - a[..., None])) / np.maximum(a, 1 / 255)[..., None]
    else:
        a = np.clip((f.max(axis=2) - 6) / soft, 0, 1)
        rgb = f / np.maximum(a, 1 / 255)[..., None]
    rgb = np.clip(rgb, 0, 255)
    rgb[a == 0] = 0
    return rgb.astype(np.uint8), a


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--key', choices=['white', 'black'], required=True, help='background colour of the render')
    ap.add_argument('--width', type=int, default=720, help='output width (height keeps the aspect, even)')
    ap.add_argument('--fps', type=float, default=30)
    ap.add_argument('--crf', type=int, default=24)
    ap.add_argument('--soft', type=float, default=None, help='levels from background to fully opaque (white 60, black 18)')
    args = ap.parse_args()
    soft = args.soft or (60 if args.key == 'white' else 18)

    cap = cv2.VideoCapture(args.input)
    src_fps = cap.get(cv2.CAP_PROP_FPS)
    W = args.width // 2 * 2
    H = int(round(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) * W / cap.get(cv2.CAP_PROP_FRAME_WIDTH))) // 2 * 2
    step = src_fps / args.fps
    enc = subprocess.Popen(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H * 2}', '-r', str(args.fps), '-i', '-',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(args.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
         '-movflags', '+faststart', '-an', args.output],
        stdin=subprocess.PIPE,
    )
    i = 0
    n = 0
    next_t = 0.0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i >= next_t - 1e-6:
            small = cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)
            rgb, a = uncomposite(small, args.key, soft)
            al = cv2.cvtColor((a * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
            enc.stdin.write(np.vstack([rgb, al]).tobytes())
            n += 1
            next_t += step
        i += 1
    enc.stdin.close()
    enc.wait()
    print(f'{args.output}: {W}×{H * 2} (colour over alpha), {n} frames @ {args.fps} fps')


if __name__ == '__main__':
    main()
