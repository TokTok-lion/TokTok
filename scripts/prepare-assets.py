"""Build public/art from the original 누끼 illustration set.

Source families (all distinct artwork, 76 files total):
  NN_<name>.png        -> family A (semantic set)
  NN_transparent_HD    -> family B
  NN_cutout_highres    -> family C
  cutout_NN_HD         -> family D

Each asset is trimmed of transparent padding, resized to ~2x its largest
on-screen size, and written as WebP (alpha preserved). Also regenerates
lib/art.ts so screens reference artwork by a typed key.

usage:
    python scripts/prepare-assets.py [path/to/누끼.zip | path/to/folder]

Defaults to ./assets-src/누끼.zip, then ./assets-src/누끼/.
Requires: pillow
"""
import sys, os, zipfile, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'public', 'art')
os.makedirs(DST, exist_ok=True)


def resolve_source() -> str:
    """Return a folder holding the 76 PNGs, extracting the zip if needed."""
    cand = sys.argv[1] if len(sys.argv) > 1 else None
    if not cand:
        for guess in ('assets-src/누끼.zip', 'assets-src/누끼', 'assets-src'):
            p = os.path.join(ROOT, guess)
            if os.path.exists(p):
                cand = p
                break
    if not cand or not os.path.exists(cand):
        sys.exit(
            'Illustration source not found.\n'
            'Pass the path:  python scripts/prepare-assets.py path/to/누끼.zip\n'
            'or place it at: assets-src/누끼.zip'
        )
    if os.path.isdir(cand):
        return cand

    out = os.path.join(tempfile.mkdtemp(prefix='toktok-art-'), 'nukki')
    os.makedirs(out, exist_ok=True)
    with zipfile.ZipFile(cand) as z:
        for info in z.infolist():
            # the archive was made on macOS: names are cp437-mangled cp949
            try:
                name = info.filename.encode('cp437').decode('cp949')
            except Exception:
                name = info.filename
            if '__MACOSX' in name or name.endswith('/'):
                continue
            with z.open(info) as fh, open(os.path.join(out, os.path.basename(name)), 'wb') as w:
                w.write(fh.read())
    return out


SRC = resolve_source()

# tier -> max dimension (design is 384pt wide; 2x for retina)
ICON, AVATAR, CARD, HERO = 160, 320, 560, 800

# source file -> (semantic name, size tier)
MAP = {
    # ---- avatars & people -------------------------------------------------
    '01_grandfather.png':        ('avatar-grandfather', AVATAR),
    '15_grandmother.png':        ('avatar-grandmother', AVATAR),
    'cutout_16_HD.png':          ('avatar-grandfather-leaf', AVATAR),
    '11_cutout_highres.png':     ('avatar-grandfather-round', AVATAR),
    '04_transparent_HD.png':     ('avatar-grandmother-round', AVATAR),
    '02_transparent_HD.png':     ('avatar-daughter', AVATAR),
    '13_transparent_HD.png':     ('portrait-grandfather', AVATAR),
    '12_daughter.png':           ('label-daughter', ICON),
    '13_son.png':                ('label-son', ICON),
    '14_granddaughter.png':      ('label-granddaughter', ICON),

    # ---- decorative -------------------------------------------------------
    '02_leaf_branch_01.png':     ('leaf-branch-1', CARD),
    '06_leaf_branch_02.png':     ('leaf-branch-2', CARD),
    '03_transparent_HD.png':     ('leaf-sprig', CARD),
    'cutout_09_HD.png':          ('heart-leaf', ICON),
    '01_transparent_HD.png':     ('heart-green', ICON),
    '20_transparent_HD.png':     ('leaf-circle-green', ICON),
    '16_cutout_highres.png':     ('leaf-circle-plant', ICON),
    'cutout_02_HD.png':          ('leaf-circle-outline', ICON),

    # ---- memory cards (기억 카드 선택) -------------------------------------
    '17_cutout_highres.png':     ('card-friends', CARD),
    '18_cutout_highres.png':     ('card-family', CARD),
    '19_cutout_highres.png':     ('card-school', CARD),
    '20_cutout_highres.png':     ('card-play', CARD),
    'cutout_01_HD.png':          ('card-holiday', CARD),

    # ---- music styles (음악 스타일 선택) -----------------------------------
    '07_cutout_highres.png':     ('style-folk-trad', CARD),
    '08_cutout_highres.png':     ('style-folk-bright', CARD),
    '09_cutout_highres.png':     ('style-ballad', CARD),
    '10_cutout_highres.png':     ('style-trot', CARD),

    # ---- album art / scenes ------------------------------------------------
    '09_first_paycheck.png':     ('scene-first-paycheck', HERO),
    'cutout_06_HD.png':          ('scene-paycheck-shop', HERO),
    'cutout_03_HD.png':          ('album-briefcase', CARD),
    '12_cutout_highres.png':     ('album-briefcase-coins', CARD),
    'cutout_04_HD.png':          ('album-lighthouse', CARD),
    '13_cutout_highres.png':     ('album-seaside', CARD),
    '05_seaside.png':            ('album-seaside-flowers', CARD),
    'cutout_05_HD.png':          ('album-family', CARD),
    '04_family.png':             ('album-family-house', CARD),
    '03_trophy.png':             ('album-trophy', CARD),
    '03_cutout_highres.png':     ('photo-hometown', CARD),
    'cutout_11_HD.png':          ('photo-hometown-polaroid', CARD),
    'cutout_12_HD.png':          ('photo-family-trio', CARD),
    '06_cutout_highres.png':     ('scene-couple-reading', HERO),
    '11_transparent_HD.png':     ('scene-couple-hands', HERO),
    'cutout_15_HD.png':          ('scene-family-phone', HERO),

    # ---- interview / question ---------------------------------------------
    '14_cutout_highres.png':     ('icon-book-open', ICON),
    '15_cutout_highres.png':     ('icon-speech-bubble', ICON),
    '02_cutout_highres.png':     ('icon-clipboard', ICON),
    '01_cutout_highres.png':     ('icon-calendar-check', ICON),
    '10_calendar_download.png':  ('icon-save-box', ICON),
    '05_cutout_highres.png':     ('icon-save-orange', ICON),
    'cutout_10_HD.png':          ('icon-pencil-orange', ICON),
    '05_transparent_HD.png':     ('icon-note-pencil', ICON),
    'cutout_07_HD.png':          ('icon-document-green', ICON),
    'cutout_08_HD.png':          ('icon-note-green', ICON),
    '16_image_icon.png':         ('icon-image-orange', ICON),
    '06_transparent_HD.png':     ('icon-image-green', ICON),
    '04_cutout_highres.png':     ('icon-heart-circle', ICON),
    '09_transparent_HD.png':     ('icon-envelope-heart', ICON),
    'cutout_13_HD.png':          ('icon-envelope-open', CARD),
    '11_letter_success.png':     ('icon-envelope-success', HERO),
    '10_transparent_HD.png':     ('icon-record-note', ICON),
    '08_transparent_HD.png':     ('icon-fast-forward', ICON),
    '12_transparent_HD.png':     ('icon-headset', ICON),
    '08_people.png':             ('icon-people-green', ICON),
    'cutout_14_HD.png':          ('icon-people-shield', ICON),
    '07_text_size.png':          ('icon-text-size', ICON),
    '17_chat_heart.png':         ('icon-chat-heart', ICON),
    '18_mic_music.png':          ('icon-mic-green', ICON),
    '19_microphone_orange.png':  ('icon-mic-orange', ICON),
    '07_transparent_HD.png':     ('icon-mic-live', ICON),
    '20_turtle_music.png':       ('icon-turtle-slow', ICON),

    # ---- observation reactions (관찰 반응 기록) ----------------------------
    '14_transparent_HD.png':     ('react-speak', ICON),
    '15_transparent_HD.png':     ('react-smile', ICON),
    '16_transparent_HD.png':     ('react-eye-contact', ICON),
    '17_transparent_HD.png':     ('react-sing-along', ICON),
    '18_transparent_HD.png':     ('react-clap', ICON),
    '19_transparent_HD.png':     ('react-rest', ICON),
}

# clear any earlier PNG run
for f in os.listdir(DST):
    os.remove(os.path.join(DST, f))

missing, rows, before, after = [], [], 0, 0
for src, (stem, cap) in MAP.items():
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        missing.append(src)
        continue
    before += os.path.getsize(p)
    im = Image.open(p).convert('RGBA')
    box = im.getbbox()
    if box:
        im = im.crop(box)                       # trim transparent padding
    if max(im.size) > cap:
        im.thumbnail((cap, cap), Image.LANCZOS)
    out = os.path.join(DST, stem + '.webp')
    im.save(out, 'WEBP', quality=90, method=6)
    after += os.path.getsize(out)
    rows.append((stem, im.width, im.height, os.path.getsize(out)))

print(f"written {len(rows)} webp files -> {DST}")
print(f"size {before/1048576:.1f}MB -> {after/1048576:.2f}MB")
if missing:
    print("MISSING SOURCES:", missing)
used = set(MAP)
unused = sorted(n for n in os.listdir(SRC) if n.endswith('.png') and n not in used)
print(f"unused sources ({len(unused)}):", unused)
print("\nlargest:")
for stem, w, h, sz in sorted(rows, key=lambda r: -r[3])[:8]:
    print(f"  {stem:30s} {w}x{h} {sz//1024}KB")

# emit a TypeScript manifest so imports are typo-proof
ts = ["// Generated by scripts/prepare-assets.py - do not edit by hand.",
      "// Source: 누끼.zip (76 hand-drawn cutout illustrations from the design deck).", "",
      "export const art = {"]
for stem, w, h, _ in sorted(rows):
    key = stem.replace('-', '_')
    ts.append(f"  {key}: {{ src: '/art/{stem}.webp', width: {w}, height: {h} }},")
ts += ["} as const;", "", "export type ArtKey = keyof typeof art;", ""]
man = os.path.join(ROOT, 'lib', 'art.ts')
os.makedirs(os.path.dirname(man), exist_ok=True)
with open(man, 'w', encoding='utf-8') as f:
    f.write("\n".join(ts))
print("\nmanifest ->", man)
