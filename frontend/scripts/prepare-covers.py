"""Build the square album covers in public/art from the watercolour still-life set.

Where these come from
---------------------
The deck only draws three album tiles (p.26, cut by prepare-scenes.py), so every
other topic borrowed a landscape illustration out of 누끼.zip and got cropped to
a square — 명절 was a 560x193 strip squeezed into a 112x112 tile. This set is a
purpose-made 1:1 series: one object still-life per topic, watercolour on cream,
no people in frame.

No people is the point, not a style choice. The tile stands next to an elder's
own story, so a drawn face would put a stranger where the story's person should
be. An object can be wrong about the topic; it cannot be wrong about a person.

Sources were exported by hand and renamed on the way into assets-src/covers/:

    first-pay          <- ChatGPT Image 2026년 8월 11일 오후 09_16_45.png
    photo-album        <- ChatGPT Image 2026년 8월 11일 오후 09_17_03.png
    travel-case        <- ChatGPT Image 2026년 8월 11일 오후 09_17_07.png
    lighthouse         <- ChatGPT Image 2026년 8월 11일 오후 09_17_09.png
    meal-table         <- ChatGPT Image 2026년 8월 11일 오후 09_17_10.png
    trophy             <- ChatGPT Image 2026년 8월 11일 오후 09_17_12.png
    school-bag         <- ChatGPT Image 2026년 8월 11일 오후 09_17_14.png
    bicycle            <- ChatGPT Image 2026년 8월 11일 오후 09_17_16.png
    songpyeon          <- ChatGPT Image 2026년 8월 11일 오후 09_17_18.png
    hoop-marbles       <- ChatGPT Image 2026년 8월 11일 오후 09_17_20.png
    family-shoes       <- ChatGPT Image 2026년 8월 12일 오전 12_21_27.png
    kettle-bowls       <- ChatGPT Image 2026년 8월 12일 오전 12_21_31.png
    photo-album-plain  <- ChatGPT Image 2026년 8월 12일 오전 12_21_35.png
    first-pay-shoes    <- ChatGPT Image 2026년 8월 12일 오후 04_07_24.png
    farming            <- ChatGPT Image 2026년 8월 12일 오후 04_07_25.png
    army               <- ChatGPT Image 2026년 8월 12일 오후 04_07_27.png
    market             <- ChatGPT Image 2026년 8월 12일 오후 04_07_29.png
    kimjang            <- ChatGPT Image 2026년 8월 12일 오후 04_07_31.png
    radio              <- ChatGPT Image 2026년 8월 12일 오후 04_07_35.png
    wedding            <- ChatGPT Image 2026년 8월 12일 오후 04_07_36.png
    house-key          <- ChatGPT Image 2026년 8월 12일 오후 04_07_38.png
    sewing             <- ChatGPT Image 2026년 8월 12일 오후 04_07_41.png
    tteokguk           <- ChatGPT Image 2026년 8월 12일 오후 04_07_44.png

Each is centre-cropped square (they arrive 1:1, so this is usually a no-op),
resized to 560px like the deck tiles, and written as cover-<name>.webp.

usage:
    python scripts/prepare-covers.py [path/to/folder]

Defaults to ./assets-src/covers/.
Run scripts/build-manifest.py afterwards to regenerate lib/art.ts.

Requires: pillow
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'public', 'art')
os.makedirs(DST, exist_ok=True)

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets-src', 'covers')
if not os.path.isdir(SRC):
    sys.exit(
        'Cover source folder not found.\n'
        'Pass the path:  python scripts/prepare-covers.py path/to/folder\n'
        'or place the PNGs at: assets-src/covers/'
    )

SIDE = 560  # same as the deck tiles (prepare-scenes.py)

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')))
if not files:
    sys.exit(f'no images in {SRC}')

print('writing:')
for f in files:
    stem = os.path.splitext(f)[0]
    with Image.open(os.path.join(SRC, f)) as im:
        img = im.convert('RGB')

    # A ChatGPT export that came back off-square would otherwise be stretched by
    # the CSS box; crop from the centre so the subject stays centred.
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((SIDE, SIDE), Image.LANCZOS)

    name = f'cover-{stem}'
    p = os.path.join(DST, name + '.webp')
    img.save(p, 'WEBP', quality=92, method=6)
    print(f'  {name:22s} {SIDE}x{SIDE}  {os.path.getsize(p)//1024}KB')

print(f'\n{len(files)} covers -> public/art')
print('Next: python scripts/build-manifest.py   (regenerates lib/art.ts)')
