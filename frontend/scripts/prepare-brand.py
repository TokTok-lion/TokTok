"""Cut the 똑똑 brand mark out of page 1 of the design deck.

The deck renders the logo over a warm gradient, so there is no alpha to
reuse; the mark is keyed out on saturation, which separates cleanly from the
pale cream backdrop. Band boundaries were confirmed visually:

  200..1884  logo glyph (note + film strip + sparkles)
  1991..2445 똑똑 wordmark
  2450..2650 TokTok wordmark

usage:
    python scripts/prepare-brand.py ["path/to/똑똑 2차.pdf"]

Defaults to ./assets-src/똑똑 2차.pdf.
Requires: pymupdf, pillow, numpy
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'brand')
os.makedirs(OUT, exist_ok=True)

PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets-src', '똑똑 2차.pdf')
if not os.path.exists(PDF):
    sys.exit(
        'Design deck not found.\n'
        'Pass the path:  python scripts/prepare-brand.py "path/to/똑똑 2차.pdf"\n'
        'or place it at: assets-src/똑똑 2차.pdf'
    )

doc = pymupdf.open(PDF)
pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(8, 8),
                        clip=pymupdf.Rect(768, 162, 1152, 952), alpha=False)
full = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
W, H = full.size

rgb = np.asarray(full).astype(np.float32) / 255.0
mx, mn = rgb.max(axis=2), rgb.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
# 0.34 clears the pale cream clouds/sun blobs that sit behind the mark
a_sat = np.clip((sat - 0.34) / 0.10, 0, 1)
a_dark = np.clip((0.80 - mx) / 0.10, 0, 1)
alpha = np.clip(np.maximum(a_sat, a_dark), 0, 1)
keyed = Image.fromarray(
    np.dstack([np.asarray(full), (alpha * 255).astype(np.uint8)]), 'RGBA')

BANDS = {
    'logo-glyph.webp':   (200, 1884, 512),
    'wordmark-ko.webp':  (1991, 2445, 420),
    'wordmark-en.webp':  (2450, 2660, 360),
    'logo-lockup.webp':  (200, 2660, 560),
}

print('writing:')
for name, (y0, y1, cap) in BANDS.items():
    seg = alpha[y0:y1] > 0.5
    xs = np.where(seg.sum(axis=0) > 0)[0]
    im = keyed.crop((int(xs.min()) - 6, y0 - 6, int(xs.max()) + 7, y1 + 6))
    b = im.getbbox()
    if b:
        im = im.crop(b)
    if max(im.size) > cap:
        im.thumbnail((cap, cap), Image.LANCZOS)
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=95, method=6)
    print(f'  {name:20s} {im.size[0]}x{im.size[1]}  {os.path.getsize(p)//1024}KB')

# Optional contact sheet on a checkerboard, so the keyed edges can be eyeballed.
if '--check' in sys.argv:
    from PIL import ImageDraw
    fs = list(BANDS)
    ims = [Image.open(os.path.join(OUT, f)).convert('RGBA') for f in fs]
    CW = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    CH = max(i.height for i in ims) + 60
    c = Image.new('RGB', (CW, CH), (255, 255, 255))
    d = ImageDraw.Draw(c)
    for by in range(0, CH, 20):
        for bx in range(0, CW, 20):
            if ((bx // 20) + (by // 20)) % 2 == 0:
                d.rectangle([bx, by, bx + 19, by + 19], fill=(205, 215, 225))
    x = 20
    for f, i in zip(fs, ims):
        c.paste(i, (x, 20), i)
        d.text((x, CH - 26), f, fill=(0, 0, 0))
        x += i.width + 20
    path = os.path.join(ROOT, 'brand-check.png')
    c.save(path)
    print('\ncontact sheet ->', path)
