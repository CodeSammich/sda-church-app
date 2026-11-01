"""Apply snap.py's pause rule again to chapters already aligned, without the speech model.

usage: python -I resnap.py <full_dir> <narrator> [narrator ...]
Reads each <full_dir>/align/<narrator>/<BOOK>/<chapter>.json ('aligned' and 'ends') and its
recording, and rewrites 'starts' and 'moved'. Run finish.py afterwards.
"""
import json, os, subprocess, sys
import numpy as np
import imageio_ffmpeg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snap import SR, find_pauses, snap_starts

full, narrators = sys.argv[1], sys.argv[2:]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
for narrator in narrators:
    sources = {(r['book'], r['chapter']): r['path'] for r in map(json.loads, open(os.path.join(full, 'audio', narrator, 'sources.jsonl')))}
    changed = 0
    for (book, chapter), path in sources.items():
        out_path = os.path.join(full, 'align', narrator, book, f'{chapter}.json')
        result = json.load(open(out_path))
        if 'aligned' not in result:
            continue
        pcm = np.frombuffer(subprocess.run([FFMPEG, '-loglevel', 'error', '-i', os.path.join(full, path), '-ac', '1', '-ar', str(SR),
                                            '-f', 's16le', '-'], capture_output=True, check=True).stdout, dtype=np.int16).astype(np.float32) / 32768
        starts, moved = snap_starts(result['aligned'], result['ends'], find_pauses(pcm))
        changed += sum(a != b for a, b in zip(starts, result['starts']))
        result.update({'starts': starts, 'moved': moved})
        with open(out_path + '.tmp', 'w') as f:
            json.dump(result, f, ensure_ascii=False)
        os.replace(out_path + '.tmp', out_path)
    print(f'{narrator}: {len(sources)} chapters, {changed} starts changed', flush=True)
