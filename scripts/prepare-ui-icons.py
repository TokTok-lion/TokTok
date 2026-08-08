"""Cut the small UI glyphs out of the design deck.

The row icons on 어르신 프로필 (호칭 · 의사소통 방식 · 선호 음악 · 피하고 싶은
주제) are drawn in the deck, not shipped in 누끼.zip. They were previously
approximated with hand-drawn SVG, which is why they did not match. These are
the originals, keyed off their pale circular backdrop.

usage:
    python scripts/prepare-ui-icons.py ["path/to/똑똑 2차.pdf"]

Requires: pymupdf, pillow, numpy
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'art')
os.makedirs(OUT, exist_ok=True)

PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets-src', '똑똑 2차.pdf')
if not os.path.exists(PDF):
    sys.exit(
        'Design deck not found.\n'
        'Pass the path:  python scripts/prepare-ui-icons.py "path/to/똑똑 2차.pdf"\n'
        'or place it at: assets-src/똑똑 2차.pdf'
    )

doc = pymupdf.open(PDF)
Z = 12  # small glyphs: render big, then downsample for clean edges

# deck p.2 어르신 프로필 — the icon column, top to bottom
PAGE = 1
COL = (800, 862)          # x range of the circular icon backdrops, in points
NAMES = ['ui-honorific', 'ui-communication', 'ui-music-pref', 'ui-avoid-topic']
BAND = (430, 800)         # y range holding the four rows

pix = doc[PAGE].get_pixmap(matrix=pymupdf.Matrix(Z, Z),
                           clip=pymupdf.Rect(COL[0], BAND[0], COL[1], BAND[1]),
                           alpha=False)
img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)

a = np.asarray(img).astype(np.float32) / 255.0
mx, mn = a.max(axis=2), a.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
# the glyph strokes are strongly coloured; the circle behind them is near-white
strong = (sat > 0.45) | (mx < 0.72)

rows = strong.sum(axis=1)
thr = max(2, int(img.width * 0.02))
bands, start = [], None
for y in range(img.height):
    on = rows[y] > thr
    if on and start is None:
        start = y
    elif not on and start is not None:
        if y - start > img.height * 0.02:
            bands.append((start, y))
        start = None
if start is not None:
    bands.append((start, img.height))

# A glyph can be drawn in separate pieces — the 호칭 person is a head above a
# shoulder arc — so bands closer than a few points belong to the same icon.
GAP = int(Z * 6)
merged = []
for band in bands:
    if merged and band[0] - merged[-1][1] < GAP:
        merged[-1] = (merged[-1][0], band[1])
    else:
        merged.append(band)
bands = merged

print(f'found {len(bands)} glyph bands (expected {len(NAMES)})')
if len(bands) != len(NAMES):
    print('  bands:', [(int(s / Z), int(e / Z)) for s, e in bands])
    sys.exit('Band detection did not match — adjust BAND/COL and retry.')

alpha = np.clip((sat - 0.30) / 0.18, 0, 1)
alpha = np.maximum(alpha, np.clip((0.78 - mx) / 0.14, 0, 1))
keyed = Image.fromarray(
    np.dstack([np.asarray(img), (alpha * 255).astype(np.uint8)]), 'RGBA')

print('writing:')
for (y0, y1), name in zip(bands, NAMES):
    seg = strong[y0:y1]
    xs = np.where(seg.sum(axis=0) > 0)[0]
    pad = int(Z * 0.6)
    crop = keyed.crop((max(0, int(xs.min()) - pad), max(0, y0 - pad),
                       min(img.width, int(xs.max()) + pad + 1),
                       min(img.height, y1 + pad)))
    b = crop.getbbox()
    if b:
        crop = crop.crop(b)
    # square canvas so every glyph optically centres in its circle
    side = max(crop.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
    sq.thumbnail((128, 128), Image.LANCZOS)
    p = os.path.join(OUT, name + '.webp')
    sq.save(p, 'WEBP', quality=95, method=6)
    print(f'  {name:20s} {sq.size[0]}x{sq.size[1]}  {os.path.getsize(p) // 1024}KB')

print('\nNext: python scripts/build-manifest.py   (regenerates lib/art.ts)')
