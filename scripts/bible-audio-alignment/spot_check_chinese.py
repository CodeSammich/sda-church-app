"""Independent check of the Chinese verse times: SenseVoice transcribes sampled chapters, the
transcript is lined up with the CUV text by sound (toneless pinyin or jyutping), and each verse's
first heard syllable is compared with its aligned start (before and after the pause rule).

usage: python -I spot_check_chinese.py <repo> <full_dir> <cuv-mandarin|cuv-cantonese> <n_random> <out.json>
Also samples up to 10 chapters the report flagged. Notes and psalm titles are kept in the
reference, so the check also shows whether the narrator reads them.
"""
import json, os, random, re, subprocess, sys, time
from difflib import SequenceMatcher
import numpy as np
import imageio_ffmpeg

repo, full, narrator, n_random, out_path = sys.argv[1:6]
TEXT = {'cuv-mandarin': 'cuv1919/hans', 'cuv-cantonese': 'cuv1919/hant'}[narrator]
LANG = {'cuv-mandarin': 'zh', 'cuv-cantonese': 'yue'}[narrator]


def han(c):
    return '一' <= c <= '鿿'


if narrator == 'cuv-mandarin':
    from pypinyin import lazy_pinyin, Style

    def sounds(text):
        cs = [c for c in text if han(c)]
        return list(zip(cs, lazy_pinyin(''.join(cs), style=Style.NORMAL, errors='ignore')))
else:
    import ToJyutping

    def sounds(text):
        return [(c, re.sub(r'\d', '', jp.split(' ')[0]) if jp else c)
                for c, jp in ToJyutping.get_jyutping_list(text) if han(c)]

books = json.load(open(os.path.join(repo, 'assets/bible', TEXT, 'books.biblejson')))
results = {}
for b in books:
    for c in range(1, b['numberOfChapters'] + 1):
        p = os.path.join(full, 'align', narrator, b['id'], f'{c}.json')
        if os.path.exists(p):
            results[(b['id'], c)] = json.load(open(p))
report = open(os.path.join(full, 'report', f'{narrator}.md')).read()
flagged = [(m.group(1), int(m.group(2))) for m in re.finditer(r'^- ([1-3A-Z]{3}) (\d+):', report, re.M)]
rng = random.Random(561)
sample = rng.sample(sorted(results), int(n_random))
sample += [k for k in rng.sample(flagged, min(10, len(flagged))) if k not in sample]

from funasr import AutoModel
model = AutoModel(model='FunAudioLLM/SenseVoiceSmall', hub='hf', vad_model='fsmn-vad',
                  vad_kwargs={'max_single_segment_time': 20000}, device='cuda:0', disable_update=True)
FF = imageio_ffmpeg.get_ffmpeg_exe()
src = {(r['book'], r['chapter']): r for r in map(json.loads, open(os.path.join(full, 'audio', narrator, 'sources.jsonl')))}
out = {}
for key in sample:
    t0 = time.time()
    r = results[key]
    if 'starts' not in r:
        continue
    wav = os.path.splitext(out_path)[0] + '.wav'
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', os.path.join(full, src[key]['path']), '-ac', '1', '-ar', '16000', wav], check=True)
    res = model.generate(input=wav, language=LANG, use_itn=False, batch_size_s=120, merge_vad=False, output_timestamp=True)
    hyp = []
    for seg in res:
        for wd, st in zip(seg.get('words') or [], seg.get('timestamp') or []):
            for ch in wd:
                if han(ch):
                    s = sounds(ch)
                    hyp.append((s[0][1] if s else ch, st[0] / 1000))
    contents = json.load(open(os.path.join(repo, 'assets/bible', TEXT, f'{key[0].lower()}.biblejson')))['contents'][key[1]]
    ref = []  # (verse, kind, sound)
    for vn, items in enumerate(contents):
        if vn == 0:
            continue
        for it in items:
            if isinstance(it, str):
                ref += [(vn, 'text', s) for _, s in sounds(it)]
            elif it.get('type') in ('note', 'heading'):
                ref += [(vn, it['type'], s) for _, s in sounds(it.get('contents', ''))]
    sm = SequenceMatcher(None, [x[2] for x in ref], [h[0] for h in hyp], autojunk=False)
    m = {}
    for a, b2, n in sm.get_matching_blocks():
        for k in range(n):
            m[a + k] = b2 + k
    first = {}
    for i, (vn, kind, _) in enumerate(ref):
        if kind == 'text':
            first.setdefault(vn, []).append(i)
    diffs = []
    for vn, idxs in first.items():
        for k in idxs[:2]:
            if k in m:
                if k == idxs[0]:
                    asr_t = hyp[m[k]][1]
                    final, raw = r['starts'][vn - 1], r['aligned'][vn - 1]
                    if final is not None:
                        diffs.append({'verse': vn, 'asr': asr_t, 'final': final, 'aligned': raw})
                break
    extra = {kind: [sum(1 for i, x in enumerate(ref) if x[1] == kind and i in m),
                    sum(1 for x in ref if x[1] == kind)] for kind in ('note', 'heading')}
    text_found = sum(1 for i, x in enumerate(ref) if x[1] == 'text' and i in m) / max(1, sum(1 for x in ref if x[1] == 'text'))
    out[f'{key[0]} {key[1]}'] = {'diffs': diffs, 'extra_heard': extra, 'text_found': round(text_found, 3),
                                 'flagged': key in flagged, 'seconds': round(time.time() - t0, 1)}
    json.dump(out, open(out_path, 'w'), ensure_ascii=False)
    print(f'{key[0]} {key[1]}: {len(diffs)} verses compared, text found {text_found:.0%}, notes/titles heard {extra}, {time.time() - t0:.0f}s', flush=True)
print('SPOTCHECK DONE', flush=True)
