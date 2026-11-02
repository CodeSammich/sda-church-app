"""Check every aligned chapter, write the app's verse-time files, and a report.

usage: python -I finish.py <repo> <full_dir> [narrator ...]
Writes <repo>/assets/bible/audio-timings/<narrator>/<book>.biblejson ({chapters: [null, [...], ...]},
one start per verse number, null for a verse with no time), <repo>/scripts/bible-audio-timing-sources/
<narrator>.json (each timed recording's size and sha256, so a re-uploaded file can be caught), and
<full_dir>/report/<narrator>.md.

The CUV joins some verses into the one before, and leaves the later number holding only 見上節
("see the verse before"). The narrators don't read it, so such a verse gets no time.

Starts checked by ear or by a recognizer and found wrong are replaced from corrections.json, next to
this script, but only while the recording's sha256 still matches the one corrected.

A chapter gets no times if it failed to align, its starts don't increase, or verse 1 starts more
than 25 s in (plus 0.6 s per character of a psalm title read before it). Verses that look odd are listed for a check but keep their times.
"""
import json, os, statistics, sys
from collections import defaultdict

repo, full = sys.argv[1:3]
narrators = sys.argv[3:] or ['cuv-mandarin', 'cuv-cantonese', 'rv1909']
TEXT = {'cuv-mandarin': 'cuv1919/hans', 'cuv-cantonese': 'cuv1919/hant', 'rv1909': 'rv1909'}
books = json.load(open(os.path.join(repo, 'assets/bible/cuv1919/hant/books.biblejson')))
SEE_VERSE_BEFORE = {'見上節', '见上节'}
CORRECTIONS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corrections.json')))

for narrator in narrators:
    results = {}
    for b in books:
        folder = os.path.join(full, 'align', narrator, b['id'])
        for c in range(1, b['numberOfChapters'] + 1):
            path = os.path.join(folder, f'{c}.json')
            if os.path.exists(path):
                results[(b['id'], c)] = json.load(open(path))
    downloaded = {}
    for line in open(os.path.join(full, 'audio', narrator, 'sources.jsonl')):
        row = json.loads(line)
        downloaded[f"{row['book']} {row['chapter']}"] = row['bytes']
    rates, scores = [], []
    for r in results.values():
        if 'error' in r:
            continue
        st = r['starts']
        for i, t in enumerate(st):
            if t is None or not r['units'][i]:
                continue
            nxt = next((x for x in st[i + 1:] if x is not None), r['ends'][i])
            if r['units'][i] >= 4:
                rates.append((nxt - t) / r['units'][i])
            if r['scores'][i] is not None:
                scores.append(r['scores'][i])
    med_rate = statistics.median(rates)
    score_floor = sorted(scores)[len(scores) // 200]  # the lowest 0.5%

    rejected, checks, moved_total, timed = [], defaultdict(list), 0, 0
    corrections, corrected, stale, joined = CORRECTIONS.get(narrator, {}), 0, [], 0
    files = defaultdict(lambda: None)
    sources = {}
    for b in books:
        chapters = [None] * (b['numberOfChapters'] + 1)
        text = json.load(open(os.path.join(repo, 'assets/bible', TEXT[narrator], f"{b['id'].lower()}.biblejson")))
        for c in range(1, b['numberOfChapters'] + 1):
            r = results.get((b['id'], c))
            key = f"{b['id']} {c}"
            if r is None:
                rejected.append((key, 'not aligned (no download?)'))
                continue
            if 'error' in r:
                rejected.append((key, r['error'][:120]))
                continue
            st = list(r['starts'])
            for i, items in enumerate(text['contents'][c][1:len(st) + 1]):
                if ''.join(x for x in items if isinstance(x, str)).strip() in SEE_VERSE_BEFORE:
                    st[i] = None
                    joined += 1
            fix = corrections.get(key)
            if fix and fix['sha256'] != r['sha256']:
                stale.append(key)
            elif fix:
                for verse, start in fix['starts'].items():
                    st[int(verse) - 1] = start
                corrected += len(fix['starts'])
            n_text = len(text['contents'][c]) - 1
            known = [t for t in st if t is not None]
            if len(st) != n_text:
                rejected.append((key, f'{len(st)} verses, text has {n_text}'))
                continue
            if any(b2 <= a for a, b2 in zip(known, known[1:])):
                rejected.append((key, 'starts not increasing'))
                continue
            # 25 s for the announcement, plus time to read a psalm's title before verse 1.
            first = text['contents'][c][1] if n_text else []
            title = first[0].get('contents', '') if first and isinstance(first[0], dict) else ''
            if not known or known[0] > 25 + 0.6 * len(title):
                rejected.append((key, f'verse 1 at {known[0] if known else None}s'))
                continue
            moved_total += len(r.get('moved', []))
            for i, t in enumerate(st):
                if t is None:
                    continue
                nxt = next((x for x in st[i + 1:] if x is not None), r['ends'][i])
                u = r['units'][i]
                if u >= 4:
                    rate = (nxt - t) / u
                    if rate > 3 * med_rate:
                        checks[key].append(f'v{i + 1} slow ({rate / med_rate:.1f}× usual)')
                    elif rate < med_rate / 3:
                        checks[key].append(f'v{i + 1} fast ({rate / med_rate:.2f}× usual)')
                if r['scores'][i] is not None and r['scores'][i] < score_floor:
                    checks[key].append(f'v{i + 1} low score {r["scores"][i]:.2f}')
            chapters[c] = st
            sources[key] = {'bytes': downloaded[key], 'sha256': r['sha256']}
            timed += 1
        out = os.path.join(repo, 'assets/bible/audio-timings', narrator)
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, f"{b['id'].lower()}.biblejson"), 'w') as f:
            f.write(json.dumps({'chapters': chapters}, separators=(',', ':')) + '\n')
    data = os.path.join(repo, 'scripts/bible-audio-timing-sources')
    os.makedirs(data, exist_ok=True)
    with open(os.path.join(data, f'{narrator}.json'), 'w') as f:
        json.dump(sources, f, indent=0)
        f.write('\n')
    os.makedirs(os.path.join(full, 'report'), exist_ok=True)
    with open(os.path.join(full, 'report', f'{narrator}.md'), 'w') as f:
        f.write(f'# {narrator}\n\n')
        f.write(f'- Chapters with times: **{timed} of 1189**\n')
        f.write(f'- Rejected (no times): {len(rejected)}\n')
        f.write(f'- Chapters with a verse to check: {len(checks)}\n')
        f.write(f'- Starts moved to the end of a pause: {moved_total}\n')
        f.write(f'- Verses that only say 見上節, given no time: {joined}\n')
        f.write(f'- Starts corrected from corrections.json: {corrected}\n')
        if stale:
            f.write(f'- Corrections not applied, because the recording changed: {", ".join(stale)}\n')
        f.write(f'- Usual pace: {med_rate:.3f} s per syllable/word; lowest 0.5% of scores below {score_floor:.2f}\n\n')
        if rejected:
            f.write('## Rejected\n\n' + ''.join(f'- {k}: {why}\n' for k, why in rejected) + '\n')
        if checks:
            f.write('## To check\n\n' + ''.join(f'- {k}: {"; ".join(v)}\n' for k, v in sorted(checks.items())) + '\n')
    print(f'{narrator}: {timed} timed, {len(rejected)} rejected, {len(checks)} to check, {moved_total} moved, '
          f'{corrected} corrected' + (f', STALE corrections: {", ".join(stale)}' if stale else ''))
