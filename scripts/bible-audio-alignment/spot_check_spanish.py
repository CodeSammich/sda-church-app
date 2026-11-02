"""Independent check of the Spanish verse times: Whisper (small, Spanish) transcribes sampled
chapters with word times, the words are lined up with the RV1909 text, and each verse's first
heard word is compared with its start. Whisper's word times are rougher than SenseVoice's
(about ±0.3 s), so this catches big misses rather than fine ones.

usage: python -I spot_check_spanish.py <repo> <full_dir> <n_random> <out.json>
"""
import json, os, random, re, subprocess, sys, time, unicodedata
from difflib import SequenceMatcher
import numpy as np, torch, imageio_ffmpeg
from transformers import pipeline

repo, full, n_random, out_path = sys.argv[1:5]


def words(text):
    t = ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if not unicodedata.combining(c))
    return [w for w in re.sub(r"[^a-z0-9 ]+", ' ', t).split() if w]


books = json.load(open(os.path.join(repo, 'assets/bible/rv1909/books.biblejson')))
keys = [(b['id'], c) for b in books for c in range(1, b['numberOfChapters'] + 1)]
sample = random.Random(561).sample(keys, int(n_random))
src = {(r['book'], r['chapter']): r for r in map(json.loads, open(os.path.join(full, 'audio/rv1909/sources.jsonl')))}
asr = pipeline('automatic-speech-recognition', model='openai/whisper-small', dtype=torch.float16, device='cuda:0')
FF = imageio_ffmpeg.get_ffmpeg_exe()
out = {}
for key in sample:
    t0 = time.time()
    r = json.load(open(os.path.join(full, 'align/rv1909', key[0], f'{key[1]}.json')))
    pcm = np.frombuffer(subprocess.run([FF, '-loglevel', 'quiet', '-i', os.path.join(full, src[key]['path']), '-ac', '1',
                                        '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout,
                        dtype=np.int16).astype(np.float32) / 32768
    res = asr({'raw': pcm, 'sampling_rate': 16000}, chunk_length_s=30, batch_size=1, return_timestamps='word',
              generate_kwargs={'language': 'es', 'task': 'transcribe'})
    hyp = [(w, ch['timestamp'][0]) for ch in res['chunks'] if ch['timestamp'][0] is not None for w in words(ch['text'])[:1]]
    contents = json.load(open(os.path.join(repo, 'assets/bible/rv1909', f'{key[0].lower()}.biblejson')))['contents'][key[1]]
    ref = [(vn, w) for vn, items in enumerate(contents) if vn for it in items if isinstance(it, str) for w in words(it)]
    sm = SequenceMatcher(None, [w for _, w in ref], [w for w, _ in hyp], autojunk=False)
    m = {a + k: b + k for a, b, n in sm.get_matching_blocks() for k in range(n)}
    firsts = {}
    for i, (vn, _) in enumerate(ref):
        firsts.setdefault(vn, i)
    diffs = []
    for vn, i in firsts.items():
        # Only verses whose first two words were both heard in order, to avoid chance matches.
        if i in m and i + 1 in m and m[i + 1] == m[i] + 1 and r['starts'][vn - 1] is not None:
            diffs.append({'verse': vn, 'asr': hyp[m[i]][1], 'final': r['starts'][vn - 1], 'aligned': r['aligned'][vn - 1]})
    out[f'{key[0]} {key[1]}'] = {'diffs': diffs, 'words_found': round(len(m) / max(1, len(ref)), 3),
                                 'extra_heard': {'note': [0, 0], 'heading': [0, 0]}, 'flagged': False}
    json.dump(out, open(out_path, 'w'))
    print(f'{key[0]} {key[1]}: {len(diffs)} verses compared, words found {len(m) / max(1, len(ref)):.0%}, {time.time() - t0:.0f}s', flush=True)
print('SPOTCHECK DONE', flush=True)
