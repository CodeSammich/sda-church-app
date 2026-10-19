"""Reads the text in Android key-screen screenshots with RapidOCR, for the
key-screen checks on Linux (#372). Apple's Vision, which reads the iPhone shots
(scripts/ocr-screens.swift), runs only on a Mac. RapidOCR's PaddleOCR models
read Chinese, English, and Spanish together, so it needs no language list.

    pip install -r scripts/ocr-requirements.txt
    python3 scripts/ocr-screens.py <image>...

Prints JSON in the shape ocr-screens.swift does: each image's path mapped to
its lines of text, each with a confidence and a box as fractions of the image,
measured from the top left: [x, y, width, height].
"""
import json
import logging
import sys

from PIL import Image
from rapidocr import RapidOCR

# RapidOCR logs each step; only the JSON belongs on stdout.
logging.disable(logging.WARNING)


def main(paths):
    engine = RapidOCR()
    results = {}
    for path in paths:
        with Image.open(path) as image:
            width, height = image.size
        output = engine(path)
        lines = []
        for points, text, score in zip(output.boxes if output.boxes is not None else [], output.txts or (), output.scores or ()):
            xs = [float(point[0]) for point in points]
            ys = [float(point[1]) for point in points]
            lines.append({
                "text": text,
                "confidence": float(score),
                "box": [min(xs) / width, min(ys) / height, (max(xs) - min(xs)) / width, (max(ys) - min(ys)) / height],
            })
        results[path] = lines
    json.dump(results, sys.stdout, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: ocr-screens.py <image>...\n")
        sys.exit(2)
    main(sys.argv[1:])
