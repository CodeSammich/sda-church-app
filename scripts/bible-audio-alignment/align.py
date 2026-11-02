"""Verse start times for the church-hosted recordings, by forced alignment (torchaudio MMS_FA).

usage: python -I align.py <repo> <full_dir> <cuv-mandarin|cuv-cantonese|rv1909> [BOOK,BOOK...]
Reads <full_dir>/audio/<narrator>/sources.jsonl and the app's bundled text; writes one result per
chapter to <full_dir>/align/<narrator>/<BOOK>/<chapter>.json. Chapters already done are skipped.

Text rules (from the John 3 study, #561):
- Mandarin: the CUV in Simplified characters as toneless pinyin. The narrator doesn't read the
  CUV's notes, so each note is a star token (any speech or none).
- Cantonese: the CUV in Traditional characters as toneless jyutping, notes included: this
  narrator reads them aloud.
- Spanish: the RV1909 as plain letters. Its notes are star tokens; its section headings, which
  sit in odd places and aren't read, are left out.
- Every chapter starts and ends with a star, for anything before the first word and after the
  last verse. The CUV narrators' announcement (约翰福音第三章, 诗篇第二十三篇) follows the first
  star as text; the Spanish narrator's ("Capítulo 3") falls to that star. A psalm's title at the
  start of verse 1 gets its own star, so verse 1 starts with its own words.
- A verse starts at its first word, and a start more than 0.5 s from the end of a pause moves to
  the nearest pause end within 1.5 s (see below).
"""
import json, os, re, subprocess, sys, time, unicodedata
import numpy as np
import torch, torchaudio
import imageio_ffmpeg

repo, full, narrator = sys.argv[1:4]
only_books = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
SR, HOP = 16000, 320
FS = HOP / SR
DEV = 'cuda' if torch.cuda.is_available() else 'cpu'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TEXT = {'cuv-mandarin': 'cuv1919/hans', 'cuv-cantonese': 'cuv1919/hant', 'rv1909': 'rv1909'}[narrator]
NOTES_SPOKEN = narrator == 'cuv-cantonese'


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def latin_words(text):
    t = strip_accents(text.lower()).replace('’', "'").replace('‘', "'")
    t = re.sub(r"[^a-z0-9' ]+", ' ', t)
    out = []
    for w in t.split():
        w = w.strip("'")
        if w:
            out.append('*' if re.search(r'\d', w) else w)
    return out


def cmn_words(text):
    from pypinyin import lazy_pinyin, Style
    han = ''.join(c for c in text if '一' <= c <= '鿿')
    syl = lazy_pinyin(han, style=Style.NORMAL, v_to_u=True, errors='ignore')
    return [re.sub(r'[^a-z]', '', strip_accents(s)) or '*' for s in syl]


def yue_words(text):
    import ToJyutping
    out = []
    for ch, jp in ToJyutping.get_jyutping_list(text):
        if '一' <= ch <= '鿿':
            out.append(re.sub(r'\d', '', jp.split(' ')[0]) if jp else '*')
    return out


romanize = {'cuv-mandarin': cmn_words, 'cuv-cantonese': yue_words, 'rv1909': latin_words}[narrator]
DIGITS = '零一二三四五六七八九'


def chinese_number(n):
    """How a chapter number is read: 3 三, 10 十, 23 二十三, 119 一百一十九."""
    if n < 10:
        return DIGITS[n]
    if n < 20:
        return '十' + (DIGITS[n % 10] if n % 10 else '')
    if n < 100:
        return DIGITS[n // 10] + '十' + (DIGITS[n % 10] if n % 10 else '')
    rest = n % 100
    tail = '' if not rest else ('零' + DIGITS[rest] if rest < 10 else ('一' if rest < 20 else '') + chinese_number(rest))
    return DIGITS[n // 100] + '百' + tail


def heading_words(book_name, book_id, chapter):
    """The chapter announcement, such as 约翰福音第三章 or 诗篇第二十三篇 (CUV narrators only)."""
    if narrator == 'rv1909':
        return []
    return romanize(f"{book_name}第{chinese_number(chapter)}{'篇' if book_id == 'PSA' else '章'}")


def verse_words(items, verse_number):
    """A verse's words, with star tokens where the narrator may or may not speak."""
    words = []
    for k, item in enumerate(items):
        if isinstance(item, str):
            words += romanize(item)
        elif item.get('type') == 'note':
            words += romanize(item.get('contents', '')) if NOTES_SPOKEN else ['*']
        elif item.get('type') == 'heading':
            # The RV1909's section headings sit in odd places and aren't read; a psalm's title
            # at verse 1 goes to the chapter's opening star.
            if narrator != 'rv1909' and not (verse_number == 1 and k == 0):
                words.append('*')
    collapsed = []
    for w in words:
        if not (w == '*' and collapsed and collapsed[-1] == '*'):
            collapsed.append(w)
    return collapsed


def decode(path):
    pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


sources = []
for line in open(os.path.join(full, 'audio', narrator, 'sources.jsonl')):
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue  # a line the downloader is still writing
    path = os.path.join(full, row['path'])
    if os.path.exists(path) and os.path.getsize(path) == row['bytes']:
        sources.append(row)
todo = [src for src in sources
        if not (only_books and src['book'] not in only_books)
        and not os.path.exists(os.path.join(full, 'align', narrator, src['book'], f"{src['chapter']}.json"))]
# MAX_CHAPTERS limits a run, so a memory check can come between runs; COUNT_ONLY just counts.
if os.environ.get('COUNT_ONLY'):
    print(len(todo))
    sys.exit(0)
todo = todo[:int(os.environ.get('MAX_CHAPTERS') or len(todo))]
if not todo:
    print(f'{narrator}: nothing to align', flush=True)
    sys.exit(0)
bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=True).eval().to(DEV)
tokenizer = bundle.get_tokenizer()
aligner = bundle.get_aligner()
books_cache = {}
from concurrent.futures import ThreadPoolExecutor
pool = ThreadPoolExecutor(max_workers=1)
pending = pool.submit(decode, os.path.join(full, todo[0]['path'])) if todo else None
done_n = 0
for n_src, src in enumerate(todo):
    book, chapter = src['book'], src['chapter']
    out_path = os.path.join(full, 'align', narrator, book, f'{chapter}.json')
    decoded, pending = pending, (pool.submit(decode, os.path.join(full, todo[n_src + 1]['path']))
                                 if n_src + 1 < len(todo) else None)
    t0 = time.time()
    if book not in books_cache:
        books_cache.clear()
        books_cache[book] = json.load(open(os.path.join(repo, 'assets/bible', TEXT, f'{book.lower()}.biblejson')))
        books_cache['name'] = next(b['name'] for b in json.load(open(os.path.join(
            repo, 'assets/bible', TEXT, 'books.biblejson'))) if b['id'] == book)
    verses = books_cache[book]['contents'][chapter]
    per_verse = [verse_words(items, number) for number, items in enumerate(verses) if number > 0]
    result = {'book': book, 'chapter': chapter, 'narrator': narrator, 'sha256': src['sha256'], 'url': src['url']}
    try:
        pcm = decoded.result()
        wav = torch.from_numpy(pcm)
        WIN, CTX = 30 * SR, 2 * SR
        with torch.inference_mode():
            parts = []
            for s in range(0, len(pcm), WIN):
                e = min(s + WIN, len(pcm))
                a, b = max(0, s - CTX), min(len(pcm), e + CTX)
                o, _ = model(wav[a:b].unsqueeze(0).to(DEV))
                o = o[0].float().cpu()
                f0 = (s - a) // HOP
                parts.append(o[f0:min(f0 + (e - s) // HOP, o.shape[0])])
            em = torch.cat(parts)
        intro = heading_words(books_cache['name'], book, chapter)
        transcript, bounds = ['*'] + intro, []
        # A psalm's title comes after the announcement and before verse 1's words.
        first = verses[1] if len(verses) > 1 else []
        if intro and first and isinstance(first[0], dict) and first[0].get('type') == 'heading':
            transcript.append('*')
        for words in per_verse:
            if transcript[-1] == '*' and words and words[0] == '*':
                words = words[1:]
            bounds.append((len(transcript), len(transcript) + len(words)))
            transcript += words
        if transcript[-1] != '*':
            transcript.append('*')
        spans = aligner(em, tokenizer(transcript))
        # Pauses (20 ms frames under -35 dB for at least 0.2 s), as ffmpeg's silencedetect finds
        # them. A start more than 0.5 s from the end of a pause moves to the nearest pause end
        # within 1.5 s, if that stays between its neighbours: the aligner sometimes gives a
        # verse the last syllable of the one before, or starts it in the pause.
        frames = len(pcm) // HOP
        rms = np.sqrt(np.mean(pcm[:frames * HOP].reshape(frames, HOP) ** 2, axis=1) + 1e-12)
        quiet = 20 * np.log10(rms) < -35
        pause_ends, run = [], 0
        for f in range(frames):
            if quiet[f]:
                run += 1
            else:
                if run >= 10:
                    pause_ends.append(f * FS)
                run = 0
        starts, ends, scores, units = [], [], [], []
        for (a, b) in bounds:
            if a == b:
                starts.append(None); ends.append(None); scores.append(None); units.append(0)
                continue
            wsp = spans[a:b]
            real_spans = [w for w, word in zip(wsp, transcript[a:b]) if word != '*']
            real = [t for w in real_spans for t in w]
            # A verse starts at its first word: a star before it may hold only a pause.
            starts.append(round((real_spans[0] if real_spans else wsp[0])[0].start * FS, 2))
            ends.append(round(wsp[-1][-1].end * FS, 2))
            scores.append(round(float(np.mean([t.score for t in real])), 3) if real else None)
            units.append(sum(1 for word in transcript[a:b] if word != '*'))
        aligned = list(starts)
        moved = []
        known = [i for i, t in enumerate(starts) if t is not None]
        for k, i in enumerate(known):
            t = starts[i]
            if not pause_ends:
                break
            near = min(pause_ends, key=lambda e: abs(e - t))
            prev = starts[known[k - 1]] if k else 0
            nxt = aligned[known[k + 1]] if k + 1 < len(known) else 1e9
            if 0.5 < abs(near - t) <= 1.5 and prev < near < nxt:
                starts[i] = round(near, 2)
                moved.append([i + 1, t, starts[i]])
        result.update({'duration': round(len(pcm) / SR, 2), 'starts': starts, 'aligned': aligned,
                       'moved': moved, 'ends': ends, 'scores': scores,
                       'units': units, 'intro_end': round(spans[len(intro)][-1].end * FS, 2) if intro else None,
                       'seconds': round(time.time() - t0, 1)})
    except Exception as error:
        result['error'] = f'{type(error).__name__}: {error}'
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path + '.tmp', 'w') as f:
        json.dump(result, f, ensure_ascii=False)
    os.replace(out_path + '.tmp', out_path)
    done_n += 1
    if done_n % 25 == 0 or 'error' in result:
        print(f"{narrator} {book} {chapter}: " + (result.get("error") or f"{len(result['starts'])} verses in {result['seconds']}s"),
              flush=True)
print(f'{narrator}: aligned {done_n} chapters', flush=True)
