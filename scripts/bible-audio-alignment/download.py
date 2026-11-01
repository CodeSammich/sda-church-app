"""Download every church-hosted Bible chapter recording, one at a time, exactly as hosted.

usage: python -I download.py <repo> <out_dir>
Reads the app's manifests (constants/*AdventistAudioManifest.ts) and writes
  <out_dir>/audio/<narrator>/<NN>_<BOOK>/<file>.mp3
  <out_dir>/audio/<narrator>/sources.jsonl   one line per file: url, sha256, bytes, last-modified
Files already downloaded with a matching size are kept. Nothing is re-encoded or changed.
"""
import hashlib, json, os, re, sys, time, urllib.request

repo, out = sys.argv[1:3]
NARRATORS = [
    ('cuv-mandarin', 'constants/CuvAdventistAudioManifest.ts'),
    ('cuv-cantonese', 'constants/CantoneseAdventistAudioManifest.ts'),
    ('rv1909', 'constants/Rv1909AdventistAudioManifest.ts'),
]
books = json.load(open(os.path.join(repo, 'assets/bible/cuv1919/hant/books.biblejson')))
BOOK_IDS = {i + 1: b['id'] for i, b in enumerate(books)}
PAUSE_S = 0.3
UA = 'NYCCSDA church app: verse timing build (one file at a time)'


def fetch(url):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
                ctype = r.headers.get('Content-Type', '')
                lastmod = r.headers.get('Last-Modified')
                expected = r.headers.get('Content-Length')
            if expected and int(expected) != len(body):
                raise IOError(f'short read {len(body)} of {expected}')
            if 'audio' not in ctype and 'octet' not in ctype:
                raise IOError(f'not audio: {ctype}')
            if not (body[:3] == b'ID3' or (body[0] == 0xFF and body[1] & 0xE0 == 0xE0)):
                raise IOError('not an MP3')
            return body, lastmod
        except Exception as error:  # retry with backoff
            wait = 5 * 2 ** attempt
            print(f'  retry {attempt + 1} in {wait}s: {url}: {error}', flush=True)
            time.sleep(wait)
    raise IOError(f'gave up: {url}')


for narrator, manifest in NARRATORS:
    text = open(os.path.join(repo, manifest)).read()
    entries = re.findall(r'"([A-Z0-9]+_B(\d\d)C(\d\d\d)\.mp3)": "(https://[^"]+)"', text)
    folder = os.path.join(out, 'audio', narrator)
    os.makedirs(folder, exist_ok=True)
    log_path = os.path.join(folder, 'sources.jsonl')
    done = {}
    if os.path.exists(log_path):
        for line in open(log_path):
            row = json.loads(line)
            done[row['file']] = row
    print(f'{narrator}: {len(entries)} chapters, {len(done)} already downloaded', flush=True)
    with open(log_path, 'a') as log:
        for n, (name, book_no, chapter, url) in enumerate(entries, 1):
            book = BOOK_IDS[int(book_no)]
            path = os.path.join(folder, f'{book_no}_{book}', name)
            if name in done and os.path.exists(path) and os.path.getsize(path) == done[name]['bytes']:
                continue
            body, lastmod = fetch(url)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path + '.part', 'wb') as f:
                f.write(body)
            os.replace(path + '.part', path)
            row = {'file': name, 'book': book, 'chapter': int(chapter), 'url': url,
                   'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'lastModified': lastmod,
                   'path': os.path.relpath(path, out)}
            log.write(json.dumps(row) + '\n')
            log.flush()
            if n % 50 == 0:
                print(f'{narrator}: {n}/{len(entries)} ({book} {int(chapter)})', flush=True)
            time.sleep(PAUSE_S)
    print(f'{narrator}: done', flush=True)
print('ALL DOWNLOADS DONE', flush=True)
