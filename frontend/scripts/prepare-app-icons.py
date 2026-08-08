"""Render the PWA / home-screen icons from the brand glyph.

Android masks icons to arbitrary shapes, so the maskable set keeps the glyph
inside the 80% safe zone on a filled cream background. iOS does not mask but
also does not respect transparency, so the apple-touch icon is pre-filled too.

usage:
    python scripts/prepare-app-icons.py

Requires: pillow
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'brand', 'logo-glyph.webp')
OUT = os.path.join(ROOT, 'public', 'icons')
os.makedirs(OUT, exist_ok=True)

if not os.path.exists(SRC):
    sys.exit('public/brand/logo-glyph.webp missing — run scripts/prepare-brand.py first.')

BG = (254, 247, 238)          # --color-page-top, so the icon sits on the app's own cream
glyph = Image.open(SRC).convert('RGBA')


def render(size: int, inset: float) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), BG + (255,))
    box = int(size * inset)
    g = glyph.copy()
    g.thumbnail((box, box), Image.LANCZOS)
    canvas.paste(g, ((size - g.width) // 2, (size - g.height) // 2), g)
    return canvas.convert('RGB')


JOBS = [
    # (filename, size, glyph share of the canvas)
    ('icon-192.png', 192, 0.78),
    ('icon-512.png', 512, 0.78),
    # maskable: Android may crop to a circle, so keep clear of the edges
    ('icon-maskable-192.png', 192, 0.58),
    ('icon-maskable-512.png', 512, 0.58),
    ('apple-touch-icon.png', 180, 0.74),
]

print('writing:')
for name, size, inset in JOBS:
    im = render(size, inset)
    p = os.path.join(OUT, name)
    im.save(p, 'PNG', optimize=True)
    print(f'  {name:26s} {size}x{size}  {os.path.getsize(p) // 1024}KB')
