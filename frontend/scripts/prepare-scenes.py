"""Extract the per-topic album artwork from page 26 of the design deck.

The deck draws the 노래 완성 / 노래 만드는 중 screens four times, once per story
topic, each with its own illustration. Three of those illustrations are not in
누끼.zip — they exist only inside the deck — so they are cut out here.

Each card holds a clean rounded-square thumbnail in its upper half; it is found
by looking for the saturated (photographic) block inside the pale card.

usage:
    python scripts/prepare-scenes.py ["path/to/똑똑 2차.pdf"]

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
        'Pass the path:  python scripts/prepare-scenes.py "path/to/똑똑 2차.pdf"\n'
        'or place it at: assets-src/똑똑 2차.pdf'
    )

doc = pymupdf.open(PDF)
PAGE = 25  # deck p.26 — 노래 완성
Z = 6

# card x-ranges in PDF points, measured off the page (see prepare-scenes notes)
CARDS = [
    ((593, 972), 'album-grandchild-day'),   # 손주와의 하루
    ((1007, 1412), 'album-first-steps'),    # 아이 첫걸음 이야기
    ((1448, 1833), 'album-honeymoon'),      # 신혼여행 이야기
]
Y0, Y1 = 152, 928

page = doc[PAGE]
print('writing:')
for (x0, x1), name in CARDS:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(Z, Z),
                          clip=pymupdf.Rect(x0, Y0, x1, Y1), alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    W, H = img.size
    # The thumbnail sits in the upper-left of the card. Search only that window
    # so the title type and the orange play button can never be mistaken for it.
    wx0, wx1 = int(W * 0.04), int(W * 0.68)
    # 0.485 clears the top arc of the orange play button, which otherwise
    # leaves a sliver along the bottom edge of the tile
    wy0, wy1 = int(H * 0.15), int(H * 0.485)
    win = img.crop((wx0, wy0, wx1, wy1))

    a = np.asarray(win).astype(np.float32) / 255.0
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    mask = sat > 0.26

    # keep rows/columns that are mostly image, which trims the rounded corners
    # and the pale card margin without eating into the artwork
    colhit = mask.sum(axis=0) > mask.shape[0] * 0.45
    rowhit = mask.sum(axis=1) > mask.shape[1] * 0.45
    if not colhit.any() or not rowhit.any():
        print(f'  {name}: no thumbnail found — check the card bounds')
        continue
    cx0, cx1 = np.where(colhit)[0][[0, -1]]
    cy0, cy1 = np.where(rowhit)[0][[0, -1]]
    crop = win.crop((int(cx0), int(cy0), int(cx1) + 1, int(cy1) + 1))

    # square it off so every album tile has the same aspect
    side = min(crop.width, crop.height)
    left = (crop.width - side) // 2
    top = (crop.height - side) // 2
    crop = crop.crop((left, top, left + side, top + side))

    crop.thumbnail((560, 560), Image.LANCZOS)
    p = os.path.join(OUT, name + '.webp')
    crop.save(p, 'WEBP', quality=92, method=6)
    print(f'  {name:24s} {crop.size[0]}x{crop.size[1]}  {os.path.getsize(p)//1024}KB')

print('\nNext: python scripts/build-manifest.py   (regenerates lib/art.ts)')
