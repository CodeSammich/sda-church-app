"""
Writes constants/ChurchSymbol.ts, the church symbol the launch animation draws
(components/LaunchSplash.tsx, #538), from the NAD's official SVG
(assets/images/brand/nad-symbol.svg).

Each white shape keeps the SVG's own path, so the finished drawing is the
official symbol. For the pen, each closed shape's outline is also cut at its
lowest and highest points into two halves that both start at the bottom, so
both edges of a line rise together. The ®, whose shapes have holes, is filled,
not drawn.

The SVG also has an open path that repeats the left page's edges, marked
repeatsEdge: it appears only once the page has filled, since the two would
overlap as a lighter triangle while fading in. test/launch-splash.test.ts
checks that the finished drawing matches the SVG.

    python3 -m venv .venv && .venv/bin/pip install svgpathtools
    .venv/bin/python scripts/make-launch-symbol.py
"""
import json
import os
import re

from svgpathtools import CubicBezier, Line, Path, QuadraticBezier, svg2paths

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'assets/images/brand/nad-symbol.svg')
OUT = os.path.join(ROOT, 'constants/ChurchSymbol.ts')
# Space kept around the symbol, in the SVG's units.
MARGIN = 2
# Samples along an outline when finding its lowest and highest points.
SAMPLES = 4000
# Where the ® starts and the Bible's top is, in the SVG's units.
ROLE_MARK_LEFT = 290
ROLE_BIBLE_TOP = 225


def number(value):
    text = f'{value:.2f}'.rstrip('0').rstrip('.')
    return '0' if text == '-0' else text


def point(z):
    return f'{number(z.real)},{number(z.imag)}'


def path_d(path):
    """An absolute path string, rounded to hundredths."""
    parts = [f'M{point(path[0].start)}']
    for segment in path:
        if isinstance(segment, Line):
            parts.append(f'L{point(segment.end)}')
        elif isinstance(segment, CubicBezier):
            parts.append(f'C{point(segment.control1)} {point(segment.control2)} {point(segment.end)}')
        elif isinstance(segment, QuadraticBezier):
            parts.append(f'Q{point(segment.control)} {point(segment.end)}')
        else:
            raise ValueError(f'Unexpected segment {segment!r}')
    return ''.join(parts)


def extreme(path, lowest):
    """The position along the path of its lowest (largest y) or highest point."""
    ts = [i / SAMPLES for i in range(SAMPLES)]
    key = lambda t: path.point(t).imag
    return max(ts, key=key) if lowest else min(ts, key=key)


def halves(path):
    """The outline as two open paths from its lowest point to its highest."""
    bottom = extreme(path, lowest=True)
    top = extreme(path, lowest=False)
    if bottom < top:
        one = path.cropped(bottom, top)
        other = Path(*path.cropped(top, 1), *path.cropped(0, bottom)).reversed()
    else:
        one = path.cropped(top, bottom).reversed()
        other = Path(*path.cropped(bottom, 1), *path.cropped(0, top))
    return [one, other]


def main():
    paths, attributes = svg2paths(SOURCE)
    shapes = []
    for path, attrs in zip(paths, attributes):
        # st1 is the white symbol; st0 is the blue square behind it.
        if attrs.get('class') != 'st1':
            continue
        d = re.sub(r'\s+', ' ', attrs['d']).strip()
        subpaths = path.continuous_subpaths()
        repeats_edge = len(subpaths) == 1 and not subpaths[0].isclosed()
        left, _, top, bottom = path.bbox()
        # The ® sits right of the Bible; the Bible's pages and the cross's
        # pieces are below the flame.
        role = 'mark' if left > ROLE_MARK_LEFT else 'bible' if top > ROLE_BIBLE_TOP else 'flame'
        drawn = len(subpaths) == 1 and not repeats_edge
        shapes.append({
            'role': role,
            'd': d,
            'top': round(top, 2),
            'bottom': round(bottom, 2),
            **({'repeatsEdge': True} if repeats_edge else {}),
            'pen': [
                {'d': path_d(half), 'length': round(half.length(), 2)}
                for half in halves(path)
            ] if drawn else [],
        })

    boxes = [path.bbox() for path, attrs in zip(paths, attributes) if attrs.get('class') == 'st1']
    left = min(box[0] for box in boxes) - MARGIN
    right = max(box[1] for box in boxes) + MARGIN
    top = min(box[2] for box in boxes) - MARGIN
    bottom = max(box[3] for box in boxes) + MARGIN
    view_box = ' '.join(number(value) for value in (left, top, right - left, bottom - top))

    with open(OUT, 'w', encoding='utf-8') as out:
        out.write('// Written by scripts/make-launch-symbol.py from the NAD\'s official\n')
        out.write('// assets/images/brand/nad-symbol.svg. Don\'t edit by hand.\n\n')
        out.write('export interface ChurchSymbolShape {\n')
        out.write('  /** The open Bible with the cross between its pages, a line of the flame,\n')
        out.write('   * or the ®. */\n')
        out.write("  role: 'bible' | 'flame' | 'mark';\n")
        out.write('  /** The official path, filled white. */\n')
        out.write('  d: string;\n')
        out.write('  /** Its highest and lowest y, in the SVG\'s units. */\n')
        out.write('  top: number;\n')
        out.write('  bottom: number;\n')
        out.write('  /** An open path that only repeats another shape\'s edges. */\n')
        out.write('  repeatsEdge?: boolean;\n')
        out.write('  /** Its outline as two halves from its lowest point to its highest, or\n')
        out.write('   * none for a shape that is only filled. */\n')
        out.write('  pen: readonly { d: string; length: number }[];\n')
        out.write('}\n\n')
        out.write(f"export const CHURCH_SYMBOL_VIEW_BOX = '{view_box}';\n\n")
        out.write('export const CHURCH_SYMBOL_SHAPES: readonly ChurchSymbolShape[] = ')
        # TypeScript style: bare keys and single quotes. No path has a quote.
        text = json.dumps(shapes, indent=2, ensure_ascii=False)
        out.write(re.sub(r'"(\w+)":', r'\1:', text).replace('"', "'"))
        out.write(';\n')
    print(f'Wrote {os.path.relpath(OUT, ROOT)}: {len(shapes)} shapes, view box {view_box}.')


if __name__ == '__main__':
    main()
