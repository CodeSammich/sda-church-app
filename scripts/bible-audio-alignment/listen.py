"""Transcribe a few seconds of a recording, to judge a verse time by its words (#573).

usage: python -I listen.py <repo> <full_dir> <narrator> <BOOK:CH:from-to> [...]
       e.g. listen.py . ~/work cuv-cantonese EXO:10:231-246

For each window, prints the app's verse starts in it, where speech resumes after each pause
(snap.py's pauses), each word or syllable the recognizer heard with its time, and the loudness
every 0.1 s (| speech, . quiet). SenseVoice for Chinese, Whisper small for Spanish, as in
check_verse_times.py.
"""
import json, os, subprocess, sys
import numpy as np
import imageio_ffmpeg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snap import SR, find_pauses

repo, full, narrator = sys.argv[1:4]
TEXT = {'cuv-mandarin': 'cuv1919/hans', 'cuv-cantonese': 'cuv1919/hant', 'rv1909': 'rv1909'}[narrator]
sources = {(r['book'], r['chapter']): r['path'] for r in map(json.loads, open(os.path.join(full, 'audio', narrator, 'sources.jsonl')))}
if narrator == 'rv1909':
    from faster_whisper import WhisperModel
    whisper = WhisperModel('small', device='cuda', compute_type='float16')

    def heard(pcm):
        segments, _ = whisper.transcribe(pcm, language='es', word_timestamps=True, beam_size=1, condition_on_previous_text=False)
        return [(float(w.start), w.word.strip()) for seg in segments for w in seg.words]
else:
    from funasr import AutoModel
    model = AutoModel(model='FunAudioLLM/SenseVoiceSmall', hub='hf', device='cuda:0', disable_update=True)
    lang = 'zh' if narrator == 'cuv-mandarin' else 'yue'

    def heard(pcm):
        res = model.generate(input=pcm, fs=SR, language=lang, use_itn=False, output_timestamp=True)[0]
        return [(ts[0] / 1000, w) for w, ts in zip(res.get('words', []), res.get('timestamp', []))]

for spec in sys.argv[4:]:
    book, chapter, span = spec.split(':')
    chapter = int(chapter)
    t0, t1 = (float(x) for x in span.split('-'))
    pcm = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-loglevel', 'error', '-i', os.path.join(full, sources[(book, chapter)]),
                          '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    pcm = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    window = pcm[int(t0 * SR):int(t1 * SR)]
    starts = json.load(open(os.path.join(repo, 'assets/bible/audio-timings', narrator, f'{book.lower()}.biblejson')))['chapters'][chapter]
    text = json.load(open(os.path.join(repo, 'assets/bible', TEXT, f'{book.lower()}.biblejson')))['contents'][chapter]
    print(f'== {narrator} {book} {chapter}, {t0:.1f}–{t1:.1f} s')
    for verse, start in enumerate(starts or [], 1):
        if start is not None and t0 <= start <= t1:
            words = ''.join(x for x in text[verse] if isinstance(x, str))
            print(f'   app: verse {verse} at {start:.2f}  {words[:30]}')
    print('   speech resumes: ' + ' '.join(f'{b:.2f}' for _, b in find_pauses(pcm) if t0 <= b <= t1))
    print('   heard: ' + ' '.join(f'{t0 + t:.2f} {w}' for t, w in heard(window)))
    frames = len(window) // (SR // 10)
    db = 20 * np.log10(np.sqrt(np.mean(window[:frames * (SR // 10)].reshape(frames, SR // 10) ** 2, axis=1)) + 1e-9)
    print('   loudness: ' + ''.join('|' if d > -35 else '.' for d in db))
