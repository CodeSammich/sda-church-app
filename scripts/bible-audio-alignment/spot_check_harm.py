"""For starts that differ from the recognizer's by over 0.3 s: early in a pause (harmless), early
over speech (marks the next verse while the last one is still read), or late.
usage: python -I spot_check_harm.py <full_dir> <narrator>"""
import json, subprocess, sys
import numpy as np, imageio_ffmpeg
full, narrator = sys.argv[1:3]
d = json.load(open(f'{full}/spot/{narrator}.json'))
src = {f"{r['book']} {r['chapter']}": r for r in map(json.loads, open(f'{full}/audio/{narrator}/sources.jsonl'))}
FF = imageio_ffmpeg.get_ffmpeg_exe()
counts = {'ok (≤0.3 s)': 0, 'early, in a pause': 0, 'early, over speech': 0, 'late 0.3–1 s': 0, 'late >1 s': 0}
worst = []
for key, v in d.items():
    pcm = np.frombuffer(subprocess.run([FF, '-loglevel', 'quiet', '-i', f"{full}/{src[key]['path']}", '-ac', '1', '-ar', '16000',
                                        '-f', 's16le', '-'], capture_output=True).stdout, dtype=np.int16).astype(np.float32) / 32768
    n = len(pcm) // 320
    db = 20 * np.log10(np.sqrt(np.mean(pcm[:n * 320].reshape(n, 320) ** 2, axis=1)) + 1e-9)
    loud = db > np.percentile(db, 90) - 25
    for x in v['diffs']:
        e = x['final'] - x['asr']
        if abs(e) <= 0.3:
            counts['ok (≤0.3 s)'] += 1
        elif e < 0:
            a, b = int(x['final'] / 0.02), int((x['asr'] - 0.15) / 0.02)
            speech = loud[a:b].mean() if b > a else 0
            if speech < 0.25:
                counts['early, in a pause'] += 1
            else:
                counts['early, over speech'] += 1
                worst.append((round(-e, 2), key, x['verse'], round(float(speech), 2)))
        else:
            counts['late 0.3–1 s' if e <= 1 else 'late >1 s'] += 1
            if e > 1:
                worst.append((round(e, 2), key, x['verse'], 'late'))
total = sum(counts.values())
print(narrator, total, 'verses:', ', '.join(f'{k} {100 * c / total:.1f}%' for k, c in counts.items()))
for w in sorted(worst, reverse=True)[:8]:
    print('  ', w)
