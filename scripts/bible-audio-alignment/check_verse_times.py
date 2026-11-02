"""Check every verse's start in the app against a speech recognizer (#573).

usage: python -I check_verse_times.py <repo> <full_dir> <narrator> [BOOK or BOOK:CH,...]

1. Transcribes each chapter's recording with a recognizer that doesn't share the aligner's model:
   SenseVoice (funasr) for Chinese, Whisper small (faster-whisper) for Spanish. What it heard,
   with times, and the recording's pauses (snap.py's) go to
   <full_dir>/heard/<narrator>/<BOOK>_<CH>.json. Chapters already transcribed
   are skipped (unless the recording changed), so it can run in batches (MAX_CHAPTERS=50) and be
   stopped and started again. COMPARE_ONLY=1 skips this step, and needs no GPU.
2. Once every chapter is transcribed, lines up every transcript with the text by sound (toneless pinyin or jyutping for Chinese,
   plain letters for Spanish) and compares each verse with its time in
   <repo>/assets/bible/audio-timings/<narrator>/. Writes <full_dir>/report/<narrator>-check.md and
   <full_dir>/report/<narrator>-check.json.

A word can't start in a pause, so a recognizer time inside one moves to where speech resumes.
Whisper often starts a word where the word before it ends, so for Spanish a time less than 0.3 s
before a pause moves too. Not for Chinese: 說 alone, before a pause, is that short.

Each verse gets up to three readings from the recognizer:
- heard: when its first word was heard, if its first two words were heard in order;
- after: the first time any of its words was heard. The verse can't start much later;
- before: the last time a word of the verse before it (or the announcement or psalm title) was
  heard. The verse can't start much earlier.
A verse is a miss when its start is more than 1 s from `heard`, more than 1 s after `after`, or
more than 1 s before `before`. A verse in corrections.json was already checked by ear, so it's
listed apart rather than as a miss. A miss whose recognizer time falls outside the neighbouring
verses' starts is set aside as doubtful: in a chapter that repeats a passage, such as Numbers 7,
the recognizer's words can line up with another copy. Each miss gets a suggested start: the
recognizer's time, moved to where speech resumes after a pause if one ends within 0.5 s.
"""
import bisect, json, os, re, subprocess, sys, time, unicodedata
from difflib import SequenceMatcher
import numpy as np
import imageio_ffmpeg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snap import SR, find_pauses

repo, full, narrator = sys.argv[1:4]
only = sys.argv[4].split(',') if len(sys.argv) > 4 else None
TEXT = {'cuv-mandarin': 'cuv1919/hans', 'cuv-cantonese': 'cuv1919/hant', 'rv1909': 'rv1909'}[narrator]
CHINESE = narrator != 'rv1909'
NOTES_SPOKEN = narrator == 'cuv-cantonese'  # as in align.py
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TOLERANCE = 1.0
LEAD_IN = 0 if CHINESE else 0.3  # see the docstring
books = json.load(open(os.path.join(repo, 'assets/bible', TEXT, 'books.biblejson')))
sources = {(r['book'], r['chapter']): r for r in map(json.loads, open(os.path.join(full, 'audio', narrator, 'sources.jsonl')))}
chapters = [(b['id'], c) for b in books for c in range(1, b['numberOfChapters'] + 1)
            if not only or b['id'] in only or f"{b['id']}:{c}" in only]
heard_dir = os.path.join(full, 'heard', narrator)
os.makedirs(heard_dir, exist_ok=True)


def han(c):
    return '一' <= c <= '鿿'


def decode(path):
    pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768


def heard_path(key):
    return os.path.join(heard_dir, f'{key[0]}_{key[1]}.json')


def transcribed(key):
    return os.path.exists(heard_path(key)) and json.load(open(heard_path(key)))['sha256'] == sources[key]['sha256']


# 1. Transcribe.
todo = [] if os.environ.get('COMPARE_ONLY') else [k for k in chapters if k in sources and not transcribed(k)]
left = len(todo) - int(os.environ.get('MAX_CHAPTERS') or len(todo))
todo = todo[:len(todo) - max(left, 0)]
if todo:
    if CHINESE:
        from funasr import AutoModel
        model = AutoModel(model='FunAudioLLM/SenseVoiceSmall', hub='hf', vad_model='fsmn-vad',
                          vad_kwargs={'max_single_segment_time': 20000}, device='cuda:0', disable_update=True)
        lang = 'zh' if narrator == 'cuv-mandarin' else 'yue'

        def transcribe(pcm):
            res = model.generate(input=pcm, fs=SR, language=lang, use_itn=False, batch_size_s=120, merge_vad=False,
                                 output_timestamp=True)
            return [[c, round(ts[0] / 1000, 2)] for seg in res
                    for word, ts in zip(seg.get('words') or [], seg.get('timestamp') or []) for c in word if han(c)]
    else:
        from faster_whisper import WhisperModel
        whisper = WhisperModel('small', device='cuda', compute_type='float16')

        def transcribe(pcm):
            segments, _ = whisper.transcribe(pcm, language='es', word_timestamps=True, beam_size=1,
                                             condition_on_previous_text=False)
            return [[w.word.strip(), round(float(w.start), 2)] for seg in segments for w in seg.words if w.word.strip()]
    for key in todo:
        t0 = time.time()
        src = sources[key]
        pcm = decode(os.path.join(full, src['path']))
        heard = transcribe(pcm)
        pauses = [[round(a, 2), round(b, 2)] for a, b in find_pauses(pcm)]
        with open(heard_path(key) + '.tmp', 'w') as f:
            json.dump({'sha256': src['sha256'], 'heard': heard, 'pauses': pauses}, f, ensure_ascii=False)
        os.replace(heard_path(key) + '.tmp', heard_path(key))
        print(f'{narrator} {key[0]} {key[1]}: {len(heard)} {"syllables" if CHINESE else "words"} heard, {time.time() - t0:.0f}s',
              flush=True)

if left > 0:
    print(f'{narrator}: {left} chapters left to transcribe; run again', flush=True)
    sys.exit(0)

# 2. Compare.
if CHINESE:
    if narrator == 'cuv-mandarin':
        from pypinyin import lazy_pinyin, Style

        def sound(c):
            return (lazy_pinyin(c, style=Style.NORMAL, errors='ignore') or [c])[0]
    else:
        import ToJyutping

        def sound(c):
            jp = ToJyutping.get_jyutping_list(c)[0][1]
            return re.sub(r'\d', '', jp.split(' ')[0]) if jp else c

    def sounds(text):
        # Character by character on both sides, so a character always sounds the same.
        return [sound(c) for c in text if han(c)]
else:
    def sounds(text):
        t = ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if not unicodedata.combining(c))
        return re.sub(r'[^a-z0-9 ]+', ' ', t).split()

DIGITS = '零一二三四五六七八九'


def chinese_number(n):
    if n < 10:
        return DIGITS[n]
    if n < 20:
        return '十' + (DIGITS[n % 10] if n % 10 else '')
    if n < 100:
        return DIGITS[n // 10] + '十' + (DIGITS[n % 10] if n % 10 else '')
    rest = n % 100
    tail = '' if not rest else ('零' + DIGITS[rest] if rest < 10 else ('一' if rest < 20 else '') + chinese_number(rest))
    return DIGITS[n // 100] + '百' + tail


def reference(book, chapter, contents):
    """(verse, kind, sound) for everything the narrator may read: verse 0 is the announcement."""
    ref = []
    if CHINESE:
        name = next(b['name'] for b in books if b['id'] == book)
        ref += [(0, 'intro', s) for s in sounds(f"{name}第{chinese_number(chapter)}{'篇' if book == 'PSA' else '章'}")]
    for vn, items in enumerate(contents):
        if vn == 0:
            continue
        for k, it in enumerate(items):
            if isinstance(it, str):
                ref += [(vn, 'text', s) for s in sounds(it)]
            elif it.get('type') == 'note' and NOTES_SPOKEN:
                ref += [(vn, 'note', s) for s in sounds(it.get('contents', ''))]
            elif it.get('type') == 'heading' and CHINESE and vn == 1 and k == 0:
                ref += [(0, 'title', s) for s in sounds(it.get('contents', ''))]  # a psalm's title
    return ref


def speech_start(t, pauses, pause_starts):
    """The time, or where speech resumes if it falls in a pause (or just before one, for Whisper)."""
    i = bisect.bisect_right(pause_starts, t + LEAD_IN) - 1
    return pauses[i][1] if i >= 0 and t < pauses[i][1] else t


def suggest(t, pauses, low, high):
    """The recognizer's time, moved to where speech resumes if a pause ends within 0.5 s."""
    ends = [b for _, b in pauses if abs(b - t) <= 0.5 and low < b < high]
    return round(min(ends, key=lambda b: abs(b - t)) if ends else t, 2)


corrections = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corrections.json'))).get(narrator, {})
by_ear = {(key.split()[0], int(key.split()[1]), int(verse)) for key, fix in corrections.items()
          if fix['sha256'] == sources.get((key.split()[0], int(key.split()[1])), {}).get('sha256') for verse in fix['starts']}
timing_books = {}
stats = {'verses': 0, 'heard': 0, 'within': {0.3: 0, 0.5: 0, 1.0: 0}, 'bounded': 0, 'chapters': 0, 'stale': []}
misses, doubtful, checked_by_ear = [], [], []
for key in chapters:
    book, chapter = key
    if not os.path.exists(heard_path(key)):
        continue
    saved = json.load(open(heard_path(key)))
    if key in sources and saved['sha256'] != sources[key]['sha256']:
        stats['stale'].append(f'{book} {chapter}')
        continue
    if book not in timing_books:
        timing_books.clear()
        timing_books[book] = (json.load(open(os.path.join(repo, 'assets/bible/audio-timings', narrator, f'{book.lower()}.biblejson'))),
                              json.load(open(os.path.join(repo, 'assets/bible', TEXT, f'{book.lower()}.biblejson'))))
    timing, text = timing_books[book]
    starts = timing['chapters'][chapter]
    if not starts:
        continue
    stats['chapters'] += 1
    ref = reference(book, chapter, text['contents'][chapter])
    pauses = saved['pauses'] if 'pauses' in saved else find_pauses(decode(os.path.join(full, sources[key]['path'])))
    pause_starts = [a for a, _ in pauses]
    hyp = [(s, speech_start(t, pauses, pause_starts)) for w, t in saved['heard']
           for s in (sounds(w)[:1] if not CHINESE else sounds(w))]
    sm = SequenceMatcher(None, [r[2] for r in ref], [h[0] for h in hyp], autojunk=False)
    at = {}  # ref index -> hyp index, only from runs of two or more, to leave out chance matches
    for a, b, n in sm.get_matching_blocks():
        if n >= 2:
            at.update({a + k: b + k for k in range(n)})
    m = {i: hyp[j][1] for i, j in at.items()}
    by_verse = {}
    for i, (vn, kind, _) in enumerate(ref):
        by_verse.setdefault(vn, []).append((i, kind))
    for vn in range(1, len(starts) + 1):
        start = starts[vn - 1]
        if start is None:
            continue
        stats['verses'] += 1
        own = by_verse.get(vn, [])
        text_idx = [i for i, kind in own if kind == 'text']
        first_two = text_idx[:2]
        heard = (m[first_two[0]] if len(first_two) == 2 and all(i in at for i in first_two)
                 and at[first_two[1]] - at[first_two[0]] == first_two[1] - first_two[0] else None)
        after = min((m[i] for i, _ in own if i in m), default=None)
        before = max((m[i] for i, _ in by_verse.get(vn - 1, []) if i in m), default=None)
        prev_start = next((s for s in reversed(starts[:vn - 1]) if s is not None), 0)
        next_start = next((s for s in starts[vn:] if s is not None), float('inf'))
        if heard is not None:
            stats['heard'] += 1
            for tol in stats['within']:
                stats['within'][tol] += abs(start - heard) <= tol
            off, rec = start - heard, heard
        elif after is not None and start > after + TOLERANCE:
            off, rec = start - after, after
        elif before is not None and start < before - TOLERANCE:
            off, rec = start - before, before
        else:
            if after is not None or before is not None:
                stats['bounded'] += 1
            continue
        if heard is None:
            stats['bounded'] += 1
        if abs(off) <= TOLERANCE:
            continue
        row = {'book': book, 'chapter': chapter, 'verse': vn, 'start': start, 'off': round(off, 2),
               'by': 'heard' if heard is not None else ('after' if off > 0 else 'before'), 'recognizer': rec}
        if (book, chapter, vn) not in by_ear and not prev_start - 0.5 <= rec <= next_start + 0.5:
            doubtful.append(row)
            continue
        if heard is not None:
            row['suggested'] = suggest(heard, pauses, prev_start, next_start)
        (checked_by_ear if (book, chapter, vn) in by_ear else misses).append(row)

total = stats['verses']
heard_n = stats['heard']
os.makedirs(os.path.join(full, 'report'), exist_ok=True)
with open(os.path.join(full, 'report', f'{narrator}-check.json'), 'w') as f:
    json.dump({'stats': {k: v for k, v in stats.items() if k != 'within'} | {'within': {str(k): v for k, v in stats['within'].items()}},
               'misses': misses, 'doubtful': doubtful, 'checked_by_ear': checked_by_ear}, f, ensure_ascii=False, indent=1)
with open(os.path.join(full, 'report', f'{narrator}-check.md'), 'w') as f:
    f.write(f'# {narrator}: every verse against the recognizer\n\n')
    f.write(f'- Chapters checked: {stats["chapters"]}; verses with times: {total}\n')
    if total:
        f.write(f'- First words heard: {heard_n} ({heard_n / total:.1%}); only bounded by nearby words: {stats["bounded"]}\n')
    if heard_n:
        f.write(''.join(f'- Within {tol} s of the recognizer: {n} ({n / heard_n:.2%})\n' for tol, n in stats['within'].items()))
    f.write(f'- Misses over {TOLERANCE} s: {len(misses)}; doubtful (recognizer time outside the neighbouring verses): {len(doubtful)}; '
            f'already checked by ear (corrections.json): {len(checked_by_ear)}\n')
    if stats['stale']:
        f.write(f'- Transcripts of an older recording, skipped: {", ".join(stats["stale"])}\n')
    for title, rows in (('Misses', misses), ('Doubtful', doubtful), ('Checked by ear', checked_by_ear)):
        if rows:
            f.write(f'\n## {title}\n\n| Verse | App | Off by | From | Suggested |\n|---|---|---|---|---|\n')
            for r in sorted(rows, key=lambda r: -abs(r['off'])):
                f.write(f"| {r['book']} {r['chapter']}:{r['verse']} | {r['start']} | {r['off']:+.2f} | {r['by']} | {r.get('suggested', '')} |\n")
print(f'{narrator}: {stats["chapters"]} chapters, {total} verses, {heard_n} heard, {stats["bounded"]} bounded, '
      f'{len(misses)} misses, {len(doubtful)} doubtful', flush=True)
