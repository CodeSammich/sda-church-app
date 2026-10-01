"""Draws the library's typographic covers in the style of gilt cloth bindings.

Every cover is drawn from scratch here, with no source artwork, using fonts
under the SIL Open Font License: Noto Serif and Noto Serif Display (Debian and
Ubuntu package fonts-noto-core) and Noto Serif CJK SC for Chinese titles
(https://github.com/notofonts/noto-cjk). Output is 512x768 PNG, like the
other library covers.

Usage (Python 3 with Pillow):
    python3 scripts/generate-library-covers.py assets/images/library \
        /path/to/NotoSerifCJKsc-Bold.otf [cover-id ...]

To add a book, add an entry to SPECS (its id matches the catalog entry in
features/library/LibraryCatalog.ts) and register the PNG in BOOK_COVERS in
features/library/LibraryCovers.ts. A Spanish edition's cover takes the book's id
with `-es` and goes in SPANISH_BOOK_COVERS. The CJK font argument is only read
for covers with a Chinese title; pass any placeholder when drawing others.
"""
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

SCALE = 2
W, H = 512 * SCALE, 768 * SCALE
GOLD = (214, 178, 96)
GOLD_DARK = (150, 118, 52)
FONTS = '/usr/share/fonts/truetype/noto'
TITLE_FONT = f'{FONTS}/NotoSerifDisplay-Bold.ttf'
AUTHOR_FONT = f'{FONTS}/NotoSerif-SemiBold.ttf'
SUBTITLE_FONT = f'{FONTS}/NotoSerif-Italic.ttf'
CJK_FONT = sys.argv[2] if len(sys.argv) > 2 else None


def cloth(color, seed):
    random.seed(seed)
    base = Image.new('RGB', (W, H), color)
    # Woven texture: fine horizontal and vertical threads.
    threads = Image.new('L', (W, H), 128)
    d = ImageDraw.Draw(threads)
    for y in range(0, H, 3):
        d.line([(0, y), (W, y)], fill=128 + random.randint(-14, 14))
    for x in range(0, W, 3):
        d.line([(x, 0), (x, H)], fill=128 + random.randint(-10, 10))
    threads = threads.filter(ImageFilter.GaussianBlur(0.6))
    # Seeded per cover, so regenerating a cover gives an identical file.
    grain = Image.frombytes('L', (W, H), random.randbytes(W * H))
    grain = grain.point(lambda v: 128 + (v - 128) * 22 // 128).filter(ImageFilter.GaussianBlur(0.8))
    tex = ImageChops.blend(threads, grain, 0.5)
    shade = Image.merge('RGB', [tex] * 3)
    base = ImageChops.overlay(base, shade)
    # Soft vignette so the edges look worn and rounded.
    vignette = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    for i in range(60):
        vd.rectangle([i * 4, i * 4, W - i * 4, H - i * 4], outline=int(255 * (i / 60) ** 0.5))
    vignette = vignette.filter(ImageFilter.GaussianBlur(40))
    dark = Image.new('RGB', (W, H), (0, 0, 0))
    return Image.composite(base, Image.blend(base, dark, 0.45), vignette)


def gilt_layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def finish(img, layer):
    # Emboss: a dark offset shadow under the gold, then a slightly uneven gold.
    alpha = layer.split()[3]
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda a: int(a * 0.55)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2))
    img = img.convert('RGBA')
    img.alpha_composite(shadow, (3, 4))
    sheen = Image.linear_gradient('L').resize((W, H)).point(lambda v: 200 + v // 5)
    gold = Image.new('RGBA', (W, H), GOLD)
    gold_dark = Image.new('RGBA', (W, H), GOLD_DARK)
    gold = Image.composite(gold, gold_dark, sheen)
    gold.putalpha(alpha)
    img.alpha_composite(gold)
    return img.convert('RGB').resize((W // SCALE, H // SCALE), Image.LANCZOS)


def frame(d):
    for inset, width in ((52, 7), (74, 3)):
        d.rounded_rectangle([inset, inset, W - inset, H - inset], radius=18, outline=255, width=width)
    # Corner ornaments: a diamond with dots at each inner corner.
    for cx, cy in ((96, 96), (W - 96, 96), (96, H - 96), (W - 96, H - 96)):
        r = 16
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=255)
        for dx, dy in ((0, -30), (30, 0), (0, 30), (-30, 0)):
            d.ellipse([cx + dx - 5, cy + dy - 5, cx + dx + 5, cy + dy + 5], fill=255)


def rule(d, cy, half=150):
    cx = W // 2
    d.line([(cx - half, cy), (cx - 22, cy)], fill=255, width=4)
    d.line([(cx + 22, cy), (cx + half, cy)], fill=255, width=4)
    d.polygon([(cx, cy - 12), (cx + 12, cy), (cx, cy + 12), (cx - 12, cy)], fill=255)


def spaced_width(text, font, tracking):
    return sum(font.getlength(ch) for ch in text) + tracking * (len(text) - 1)


def draw_spaced(d, text, font, cy, tracking):
    x = (W - spaced_width(text, font, tracking)) / 2
    for ch in text:
        d.text((x, cy), ch, font=font, fill=255, anchor='lm')
        x += font.getlength(ch) + tracking


def wrap(words, font, tracking, max_width):
    lines, line = [], ''
    for word in words:
        trial = f'{line} {word}'.strip()
        if spaced_width(trial, font, tracking) <= max_width:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def title_block(d, title, top, max_width=700, max_size=92, min_size=56, max_lines=4):
    for size in range(max_size, min_size - 1, -4):
        font = ImageFont.truetype(TITLE_FONT, size)
        tracking = size * 0.08
        lines = wrap(title.upper().split(), font, tracking, max_width)
        if len(lines) <= max_lines:
            break
    line_height = size * 1.28
    for i, line in enumerate(lines):
        draw_spaced(d, line, font, top + i * line_height, tracking)
    return top + (len(lines) - 1) * line_height


def leaf(d, x, y, angle, length, width):
    pts = []
    for i in range(21):
        t = i / 20
        pts.append((t * length, width * math.sin(math.pi * t)))
    for i in range(20, -1, -1):
        t = i / 20
        pts.append((t * length, -width * math.sin(math.pi * t) * 0.6))
    ca, sa = math.cos(angle), math.sin(angle)
    d.polygon([(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts], fill=255)


def curve(d, points, width):
    d.line(points, fill=255, width=width, joint='curve')
    for x, y in (points[0], points[-1]):
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)


def quad(p0, p1, p2, n=40):
    return [
        (
            (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
        )
        for t in (i / n for i in range(n + 1))
    ]


# Emblems, centered on (cx, cy), roughly 380px across at 2x.

def emblem_reed(d, cx, cy):
    # A reed bent over but not broken (Isaiah 42:3).
    stem = quad((cx - 40, cy + 190), (cx - 10, cy - 150), (cx + 120, cy - 120))
    curve(d, stem, 9)
    leaf(d, cx - 34, cy + 120, -2.2, 150, 18)
    leaf(d, cx - 28, cy + 60, -0.9, 170, 18)
    leaf(d, cx - 22, cy - 10, -2.5, 140, 15)
    leaf(d, cx + 118, cy - 118, 1.1, 90, 16)
    d.line([(cx - 150, cy + 196), (cx + 150, cy + 196)], fill=255, width=5)
    for dx in (-110, -60, 60, 110):
        leaf(d, cx + dx, cy + 196, -math.pi / 2 + (0.35 if dx > 0 else -0.35), 70, 9)


def emblem_vine(d, cx, cy):
    # The vine and the branches (John 15).
    stem = quad((cx, cy + 200), (cx - 40, cy), (cx + 10, cy - 190))
    curve(d, stem, 10)
    for side, y0 in ((-1, cy + 90), (1, cy + 10), (-1, cy - 80)):
        branch = quad((cx - 12, y0), (cx + side * 90, y0 - 60), (cx + side * 160, y0 - 20))
        curve(d, branch, 7)
        leaf(d, cx + side * 70, y0 - 44, -math.pi / 2 + side * 0.9, 100, 30)
        gx, gy = cx + side * 150, y0 + 10
        for row, count in enumerate((4, 3, 2, 1)):
            for k in range(count):
                x = gx + (k - (count - 1) / 2) * 30
                y = gy + row * 26
                d.ellipse([x - 13, y - 13, x + 13, y + 13], fill=255)


def emblem_wheat(d, cx, cy):
    # A ripe ear of wheat bowing its head: humility.
    stem = quad((cx - 70, cy + 210), (cx - 40, cy - 140), (cx + 60, cy - 150))
    curve(d, stem, 8)
    # The ear hangs from the top of the stem: pairs of grains along a curve.
    axis = quad((cx + 60, cy - 150), (cx + 150, cy - 140), (cx + 175, cy - 20), n=7)
    for i in range(len(axis) - 1):
        (x0, y0), (x1, y1) = axis[i], axis[i + 1]
        heading = math.atan2(y1 - y0, x1 - x0)
        for side in (-1, 1):
            leaf(d, x0, y0, heading + side * 0.55, 50, 15)
            # Awns: fine bristles off each grain.
            ax = x0 + 50 * math.cos(heading + side * 0.55)
            ay = y0 + 50 * math.sin(heading + side * 0.55)
            d.line([(ax, ay), (ax + 45 * math.cos(heading + side * 0.3), ay + 45 * math.sin(heading + side * 0.3))], fill=255, width=3)
    x_end, y_end = axis[-1]
    leaf(d, x_end, y_end, math.pi / 2 - 0.2, 40, 13)
    leaf(d, cx - 60, cy + 90, -2.1, 170, 20)
    leaf(d, cx - 52, cy + 20, -0.75, 140, 17)
    d.line([(cx - 170, cy + 214), (cx + 130, cy + 214)], fill=255, width=5)


def emblem_wreath(d, cx, cy):
    # A laurel wreath: the crown of life (Revelation 2:10).
    r = 165
    for side in (-1, 1):
        pts = []
        for i in range(31):
            a = math.radians(100 + i * 5.2) if side < 0 else math.radians(80 - i * 5.2)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        curve(d, pts, 6)
        for i in range(2, 31, 3):
            a = math.radians(100 + i * 5.2) if side < 0 else math.radians(80 - i * 5.2)
            x, y = cx + r * math.cos(a), cy + r * math.sin(a)
            tangent = a + (math.pi / 2 if side < 0 else -math.pi / 2)
            leaf(d, x, y, tangent - side * 0.5, 62, 16)
            leaf(d, x, y, tangent + side * 0.9, 50, 13)
    d.polygon([(cx - 40, cy + r - 10), (cx, cy + r + 20), (cx + 40, cy + r - 10), (cx, cy + r + 4)], fill=255)
    d.line([(cx, cy + r + 10), (cx - 30, cy + r + 70)], fill=255, width=6)
    d.line([(cx, cy + r + 10), (cx + 30, cy + r + 70)], fill=255, width=6)


def star(d, x, y, r):
    pts = []
    for i in range(10):
        rad = r if i % 2 == 0 else r * 0.42
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((x + rad * math.cos(a), y + rad * math.sin(a)))
    d.polygon(pts, fill=255)


def emblem_scroll(d, cx, cy):
    # An open scroll under seven stars (Daniel 12:4; Revelation 1:20).
    for i in range(7):
        a = math.radians(200 + i * 23.3)
        star(d, cx + 170 * math.cos(a), cy - 10 + 110 * math.sin(a), 20)
    top, bottom = cy + 40, cy + 170
    d.rectangle([cx - 150, top, cx + 150, bottom], outline=255, width=7)
    for x in (cx - 150, cx + 150):
        d.rounded_rectangle([x - 18, top - 22, x + 18, bottom + 22], radius=16, outline=255, width=7)
    for y in range(top + 30, bottom - 10, 26):
        d.line([(cx - 110, y), (cx + 110, y)], fill=255, width=3)


def emblem_sun(d, cx, cy, rising):
    # Rising: resurrection morning. Setting over water: the Sabbath begins.
    horizon = cy + 80
    r = 95
    d.pieslice([cx - r, horizon - r, cx + r, horizon + r], 180, 360, fill=255)
    for i in range(13):
        a = math.radians(180 + i * 15)
        inner, outer = r + 26, r + (95 if i % 2 == 0 else 60)
        d.line(
            [(cx + inner * math.cos(a), horizon + inner * math.sin(a)),
             (cx + outer * math.cos(a), horizon + outer * math.sin(a))],
            fill=255, width=7,
        )
    d.line([(cx - 190, horizon), (cx + 190, horizon)], fill=255, width=7)
    if rising:
        hills = quad((cx - 190, horizon + 60), (cx - 80, horizon - 10), (cx + 10, horizon + 45))
        curve(d, hills, 6)
        hills = quad((cx - 30, horizon + 50), (cx + 90, horizon - 5), (cx + 190, horizon + 60))
        curve(d, hills, 6)
    else:
        for k, half in enumerate((150, 110, 70)):
            y = horizon + 30 + k * 26
            d.line([(cx - half, y), (cx + half, y)], fill=255, width=5)


def emblem_tablets(d, cx, cy):
    # The two tables of the law, with the fourth commandment picked out.
    numeral = ImageFont.truetype(TITLE_FONT, 30)
    for side, numerals in ((-1, ('I', 'II', 'III', 'IV', 'V')), (1, ('VI', 'VII', 'VIII', 'IX', 'X'))):
        left = cx + (-175 if side < 0 else 10)
        right = left + 165
        top, bottom = cy - 170, cy + 190
        d.arc([left, top, right, top + 165], 180, 360, fill=255, width=8)
        d.line([(left, top + 82), (left, bottom)], fill=255, width=8)
        d.line([(right, top + 82), (right, bottom)], fill=255, width=8)
        d.line([(left, bottom), (right, bottom)], fill=255, width=8)
        for k, text in enumerate(numerals):
            y = top + 95 + k * 55
            if text == 'IV':
                d.rounded_rectangle([left + 34, y - 24, right - 34, y + 24], radius=10, outline=255, width=4)
            d.text(((left + right) / 2, y), text, font=numeral, fill=255, anchor='mm')


def emblem_hourglass(d, cx, cy):
    # An hourglass: the history of the week across the centuries.
    top, bottom = cy - 190, cy + 190
    for y in (top, bottom):
        d.rounded_rectangle([cx - 150, y - 16, cx + 150, y + 16], radius=8, fill=255)
    for x in (cx - 125, cx + 125):
        d.line([(x, top), (x, bottom)], fill=255, width=9)
    glass = [(cx - 95, top + 26), (cx + 95, top + 26), (cx + 12, cy), (cx + 95, bottom - 26),
             (cx - 95, bottom - 26), (cx - 12, cy)]
    d.line(glass + [glass[0]], fill=255, width=7, joint='curve')
    # Sand: a small heap left above, a fuller one below, and a falling stream.
    d.polygon([(cx - 45, top + 70), (cx + 45, top + 70), (cx, cy - 20)], fill=255)
    d.polygon([(cx - 85, bottom - 30), (cx + 85, bottom - 30), (cx, bottom - 105)], fill=255)
    d.line([(cx, cy - 20), (cx, bottom - 100)], fill=255, width=4)


def emblem_city(d, cx, cy):
    # The narrow way up the hill to the gate of the Celestial City.
    base = cy - 60
    # Glory behind the city.
    for i in range(15):
        a = math.radians(180 + i * (180 / 14))
        inner, outer = 120, 205 if i % 2 == 0 else 165
        d.line(
            [(cx + inner * math.cos(a), base - 40 + inner * math.sin(a)),
             (cx + outer * math.cos(a), base - 40 + outer * math.sin(a))],
            fill=255, width=6,
        )
    # Towers: a tall one over the gate, two lower ones, each with a spire.
    for x, half, top in ((cx, 34, base - 135), (cx - 82, 26, base - 90), (cx + 82, 26, base - 90)):
        d.rectangle([x - half, top, x + half, base], fill=255)
        d.polygon([(x - half - 6, top), (x + half + 6, top), (x, top - 58)], fill=255)
    d.rectangle([cx - 108, base - 50, cx + 108, base], fill=255)
    # The gate stands open, and windows light the towers.
    d.rectangle([cx - 17, base - 40, cx + 17, base], fill=0)
    d.pieslice([cx - 17, base - 58, cx + 17, base - 24], 180, 360, fill=0)
    for x, y in ((cx, base - 100), (cx - 82, base - 68), (cx + 82, base - 68)):
        d.rounded_rectangle([x - 7, y - 12, x + 7, y + 12], radius=6, fill=0)
    # The hill, and the way winding up it, narrowing toward the gate.
    curve(d, quad((cx - 200, cy + 200), (cx - 120, base + 10), (cx - 40, base + 4)), 6)
    curve(d, quad((cx + 40, base + 4), (cx + 120, base + 10), (cx + 200, cy + 200)), 6)
    left = quad((cx - 90, cy + 205), (cx + 110, cy + 90), (cx - 12, base + 6), n=50)
    right = quad((cx + 10, cy + 205), (cx + 150, cy + 80), (cx + 12, base + 6), n=50)
    curve(d, left, 5)
    curve(d, right, 5)


def emblem_shepherd(d, cx, cy):
    # The Good Shepherd (John 10): a lamb under a shepherd's crook.
    k = 1.22

    def box(x, y, rx, ry=None):
        ry = rx if ry is None else ry
        return [cx + (x - rx) * k, cy + (y - ry) * k, cx + (x + rx) * k, cy + (y + ry) * k]

    # The crook: a shaft whose top curls over the lamb.
    d.line([(cx + 120 * k, cy + 170 * k), (cx + 120 * k, cy - 150 * k)], fill=255, width=13)
    d.arc(box(50, -150, 70), 180, 360, fill=255, width=13)
    d.ellipse(box(-20, -150, 12), fill=255)
    # The lamb: a fleece of overlapping curls and four legs.
    for x, y, r in ((-86, 20, 50), (-40, -14, 52), (16, -18, 52), (64, 8, 50),
                    (70, 50, 44), (16, 60, 50), (-38, 58, 50), (-88, 56, 42)):
        d.ellipse(box(x, y, r), fill=255)
    for x in (-74, -32, 28, 66):
        d.rounded_rectangle(box(x, 132, 10, 38), radius=7, fill=255)
    # The head, set off from the fleece by a thin line of cloth, with a
    # drooping ear and an eye.
    d.ellipse(box(-146, -30, 44, 42), fill=0)
    d.ellipse(box(-146, -30, 38, 36), fill=255)
    ear = (cx - 126 * k, cy - 58 * k)
    leaf(d, ear[0], ear[1], -0.4, 48 * k, 12 * k)
    d.ellipse(box(-160, -30, 6), fill=0)
    # Ground and grass.
    d.line([(cx - 200 * k, cy + 170 * k), (cx + 170 * k, cy + 170 * k)], fill=255, width=5)
    for x in (-160, -118, 150):
        leaf(d, cx + x * k, cy + 170 * k, -math.pi / 2 - 0.35, 40 * k, 8)
        leaf(d, cx + (x + 8) * k, cy + 170 * k, -math.pi / 2 + 0.35, 34 * k, 7)


EMBLEMS = {
    'city': emblem_city,
    'shepherd': emblem_shepherd,
    'reed': emblem_reed,
    'vine': emblem_vine,
    'wheat': emblem_wheat,
    'wreath': emblem_wreath,
    'scroll': emblem_scroll,
    'tablets': emblem_tablets,
    'hourglass': emblem_hourglass,
    'sunrise': lambda d, cx, cy: emblem_sun(d, cx, cy, True),
    'sunset': lambda d, cx, cy: emblem_sun(d, cx, cy, False),
}


def make_cover(spec, out_dir):
    img = cloth(spec['color'], spec['id'])
    layer = gilt_layer()
    alpha = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(alpha)
    frame(d)
    rule(d, 190, half=110)
    if spec.get('cjk_title'):
        font = ImageFont.truetype(CJK_FONT, 150)
        d.text((W / 2, 400), spec['cjk_title'], font=font, fill=255, anchor='mm')
        sub = ImageFont.truetype(SUBTITLE_FONT, 44)
        d.text((W / 2, 520), spec['title'], font=sub, fill=255, anchor='mm')
        last = 520
    else:
        last = title_block(d, spec['title'], 290)
    rule(d, int(last + 95))
    author = ImageFont.truetype(AUTHOR_FONT, 40)
    author_y = last + 160
    draw_spaced(d, spec['author'].upper(), author, author_y, 7)
    # Center the emblem in the space between the author and the bottom frame.
    EMBLEMS[spec['emblem']](d, W // 2, int((author_y + 40 + H - 74) / 2))
    layer.putalpha(alpha)
    cover = finish(img, layer)
    cover.save(os.path.join(out_dir, f"{spec['id']}.png"), optimize=True)


SPECS = [
    {'id': 'bunyan-pilgrims-progress', 'title': "The Pilgrim's Progress",
     'author': 'John Bunyan', 'color': (78, 30, 46), 'emblem': 'city'},
    {'id': 'story-of-jesus', 'title': 'The Story of Jesus',
     'author': 'Ellen G. White', 'color': (30, 56, 100), 'emblem': 'shepherd'},
    {'id': 'bates-seventh-day-sabbath', 'title': 'The Seventh Day Sabbath, a Perpetual Sign',
     'author': 'Joseph Bates', 'color': (29, 63, 68), 'emblem': 'tablets'},
    {'id': 'andrews-history-sabbath', 'title': 'History of the Sabbath and First Day of the Week',
     'author': 'J. N. Andrews', 'color': (58, 46, 72), 'emblem': 'hourglass'},
    {'id': 'smith-state-dead-destiny-wicked', 'title': 'The State of the Dead and the Destiny of the Wicked',
     'author': 'Uriah Smith', 'color': (30, 42, 68), 'emblem': 'sunrise'},
    {'id': 'smith-daniel-revelation', 'title': 'Daniel and the Revelation',
     'author': 'Uriah Smith', 'color': (91, 30, 34), 'emblem': 'scroll'},
    {'id': 'murray-humility', 'title': 'Humility',
     'author': 'Andrew Murray', 'color': (35, 64, 47), 'emblem': 'wheat'},
    {'id': 'murray-abide-in-christ', 'title': 'Abide in Christ',
     'author': 'Andrew Murray', 'color': (46, 63, 36), 'emblem': 'vine'},
    {'id': 'foxe-book-of-martyrs', 'title': "Foxe's Book of Martyrs",
     'author': 'John Foxe', 'color': (62, 42, 30), 'emblem': 'wreath'},
    {'id': 'sibbes-bruised-reed', 'title': 'The Bruised Reed',
     'author': 'Richard Sibbes', 'color': (43, 58, 69), 'emblem': 'reed'},
    {'id': 'sabbath-encouragement', 'title': 'Sabbath Encouragement', 'cjk_title': '安息日勉言',
     'author': 'Bible and Ellen G. White', 'color': (35, 38, 74), 'emblem': 'sunset'},
    {'id': 'hurlbut-story-of-the-bible', 'title': 'Story of the Bible',
     'author': 'Jesse Lyman Hurlbut', 'color': (92, 58, 26), 'emblem': 'tablets'},
    {'id': 'hurlbut-life-of-christ', 'title': 'The Life of Christ',
     'author': 'Jesse Lyman Hurlbut', 'color': (24, 70, 88), 'emblem': 'shepherd'},
    {'id': 'taylor-pastor-hsi', 'title': 'Pastor Hsi',
     'author': 'Mrs. Howard Taylor', 'color': (110, 36, 30), 'emblem': 'sunrise'},
    {'id': 'taylor-hudson-taylor-early-years', 'title': 'Hudson Taylor in Early Years',
     'author': 'Dr. and Mrs. Howard Taylor', 'color': (38, 52, 84), 'emblem': 'wheat'},
    # Spanish editions, in the colors and emblems of their English covers.
    {'id': 'bunyan-pilgrims-progress-es', 'title': 'El progreso del peregrino para todos',
     'author': 'Juan Bunyan', 'color': (78, 30, 46), 'emblem': 'city'},
    {'id': 'story-of-jesus-es', 'title': 'Cristo Nuestro Salvador',
     'author': 'Elena G. de White', 'color': (30, 56, 100), 'emblem': 'shepherd'},
    {'id': 'andrews-history-sabbath-es', 'title': 'Historia del Sábado',
     'author': 'J. N. Andrews', 'color': (58, 46, 72), 'emblem': 'hourglass'},
]

if __name__ == '__main__':
    out = sys.argv[1]
    only = set(sys.argv[3:])
    for spec in SPECS:
        if not only or spec['id'] in only:
            make_cover(spec, out)
            print('wrote', spec['id'])
