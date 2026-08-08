"""Cut the small UI glyphs out of the design deck.

The deck draws its own row/badge icons — document, clock, smiley, leaf,
pencil, people, music note, calendar, clipboard … — and they are not in
누끼.zip. They were originally approximated with hand-drawn SVG, which is why
they did not match. These are the originals.

Each glyph sits inside a pale tinted disc. The disc is found first (a filled
round patch that is neither white nor strongly coloured), then the saturated
strokes inside it are keyed out.

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
Z = 12          # small glyphs: render big, downsample for clean edges
PHONE = (768, 150, 1152, 955)   # the phone mock on a deck page, in points

# page index (0-based) -> badges to pull, as (name, x0, y0, x1, y1) in points.
# Boxes are generous; the disc inside is located automatically.
JOBS = {
    1: [  # p.2 어르신 프로필
        ('ui-honorific', 800, 455, 862, 500),
        ('ui-communication', 800, 528, 862, 578),
        ('ui-music-pref', 800, 628, 862, 678),
        ('ui-avoid-topic', 800, 718, 862, 768),
    ],
    9: [  # p.10 활동일지 편집 — x stops at 842; the row label starts near 845
        ('ui-program', 804, 288, 842, 336),
        ('ui-duration', 804, 345, 842, 395),
        ('ui-reaction', 804, 405, 842, 455),
        ('ui-next-topic', 804, 500, 842, 550),
        ('ui-draft', 804, 560, 842, 612),
    ],
    10: [  # p.11 기억 카드 선택
        ('ui-bulb', 812, 765, 852, 804),
    ],
    15: [  # p.16 가족 답장 보기
        ('ui-image', 924, 312, 956, 344),
        ('ui-mic', 806, 628, 861, 684),
        ('ui-heart', 854, 776, 874, 797),
    ],
    20: [  # p.21 인터뷰 진행 중 — 보조 질문 행
        ('ui-gift', 824, 538, 857, 571),
    ],
    16: [  # p.17 회기 일정
        ('ui-people', 1075, 522, 1125, 570),
        ('ui-music', 1075, 592, 1125, 640),
        ('ui-pencil', 1075, 662, 1125, 710),
        ('ui-calendar-check', 820, 728, 872, 780),
        ('ui-clipboard', 980, 728, 1032, 780),
    ],
}


def extract(page_index: int, name: str, box) -> bool:
    pix = doc[page_index].get_pixmap(matrix=pymupdf.Matrix(Z, Z),
                                     clip=pymupdf.Rect(*box), alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    a = np.asarray(img).astype(np.float32) / 255.0
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

    # glyph strokes: clearly coloured, or dark
    strong = (sat > 0.42) | (mx < 0.70)
    ys, xs = np.where(strong)
    if len(xs) < 20:
        print(f'  {name:20s} SKIP — no glyph found in box')
        return False

    alpha = np.clip((sat - 0.28) / 0.18, 0, 1)
    alpha = np.maximum(alpha, np.clip((0.76 - mx) / 0.14, 0, 1))
    keyed = Image.fromarray(
        np.dstack([np.asarray(img), (alpha * 255).astype(np.uint8)]), 'RGBA')

    pad = int(Z * 0.5)
    crop = keyed.crop((max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
                       min(img.width, int(xs.max()) + pad + 1),
                       min(img.height, int(ys.max()) + pad + 1)))
    b = crop.getbbox()
    if b:
        crop = crop.crop(b)

    side = max(crop.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
    sq.thumbnail((128, 128), Image.LANCZOS)
    p = os.path.join(OUT, name + '.webp')
    sq.save(p, 'WEBP', quality=95, method=6)
    print(f'  {name:20s} {sq.size[0]}x{sq.size[1]}  {os.path.getsize(p) // 1024}KB')
    return True


print('writing:')
ok = 0
for page_index, jobs in JOBS.items():
    for name, *box in jobs:
        if extract(page_index, name, box):
            ok += 1
print(f'\n{ok} glyphs written')
print('Next: python scripts/build-manifest.py   (regenerates lib/art.ts)')
