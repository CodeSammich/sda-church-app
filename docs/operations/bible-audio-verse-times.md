# Bible audio verse times

While a chapter's audio plays, the Bible reader marks the verse being read and keeps it in
the middle of the screen (#561). It needs to know when each verse starts in each
recording. This page covers how those times were made and checked, and how to make them for
a new narrator or language.

- **The times:** `assets/bible/audio-timings/<narrator>/<book>.biblejson`. Each chapter
  holds every verse's start in seconds, by verse number, or null. They ship with the app,
  so they work offline. `services/BibleAudioTimings.ts` reads them.
- **The recordings never change.** Times are found by listening to the files as hosted.
  Nothing is re-encoded, re-tagged, or uploaded again. WordProject's terms forbid changing
  its files ([LEGAL.md](../LEGAL.md)).
- **The app side:** [Bible integration §4.7](../feature_designs/bible_integration_design.md#47-the-verse-being-read-aloud-done)
  has what the reader does with the times and how accurate they are.

## When to do this

- **A new narrator or language** with audio. Follow every step below.
- **A replaced recording** on the church's host. `scripts/bible-audio-timing-sources/<narrator>.json`
  keeps each timed file's size and SHA-256. A file that no longer matches needs aligning
  again.
  - **Keep the work folder:** `finish.py` writes every chapter from it, so it needs every
    chapter's result, not just the new one. Without it, align the whole narrator again.
  - **In the work folder,** delete the old file, its line in
    `audio/<narrator>/sources.jsonl`, and its result in `align/`. Then run steps 4 to 8:
    each step skips what's already done. The chapter's entry in `corrections.json` no
    longer applies, so check that chapter by ear again. Then update the entry's starts and
    SHA-256, or delete it: the tests fail until you do.
- **A text change that moves verses,** such as a verse split differently. The tests fail
  when a chapter's times no longer have one entry per verse.

## If the provider publishes verse times

HelloAO publishes them for three of its four BSB narrators.
`scripts/build-bible-audio-timings.mjs` downloads them and keeps a chapter only when
HelloAO's recording is the one the app plays and the verse numbers match the bundled text.
The script only reads the BSB, and the BSB's other narrator, Gilbert, has no published
times. A HelloAO narrator in another translation also needs that translation added to the
script, to `services/BibleAudioTimings.ts`, and to the tests. For a new provider, check its
terms first, and record them in [LEGAL.md](../LEGAL.md).

## Otherwise: line up the text with the recording

The church's Mandarin, Cantonese, and Spanish recordings have no published times. A speech
model lines up the bundled text with each recording (forced alignment), and each verse's
time is where its first word starts. Speech recognizers that don't share the model then
check the result. The scripts are in `scripts/bible-audio-alignment/`.

### What you need

- **A GPU:** an NVIDIA GPU with CUDA. Aligning takes 3 to 5 seconds a chapter on a
  consumer card, or about a minute on a CPU. Checking with a recognizer takes 5 to 10
  seconds a chapter, and needs the GPU.
- **Python packages:** a virtual environment with `torch` and `torchaudio` 2.8 (the CUDA
  build), `numpy`, `imageio-ffmpeg`, and a romanizer for the language's script:
  `pypinyin` for Mandarin, `ToJyutping` for Cantonese, none for a Latin script.
- **A recognizer, for the checks:**
  - **Chinese:** `funasr`, for SenseVoice.
  - **Other languages:** `faster-whisper`, for Whisper, in `check_verse_times.py` and
    `listen.py`. It also needs NVIDIA's cuBLAS and cuDNN for CUDA 12
    (`nvidia-cublas-cu12` and `nvidia-cudnn-cu12`; the CUDA build of `torch` already
    installs them), and doesn't find them by itself: put their folders,
    `site-packages/nvidia/cublas/lib` and `site-packages/nvidia/cudnn/lib`, on
    `LD_LIBRARY_PATH`. `spot_check_spanish.py` uses `transformers` instead.
- **Disk:** under 1 GB of recordings per narrator. Keep them outside the repository.
  `download.py` downloads every narrator in its list, so comment out the ones you don't
  need.
- **Run Python with `-I`.** The recordings are downloaded files, and `-I` keeps Python
  from loading code from the folders around them.

### 1. Check the rights

The recording's terms must allow the app to play it. Times don't change the audio, so
they need nothing more. Record the permission in [LEGAL.md](../LEGAL.md) with the
recording's other terms.

### 2. Study one chapter

Pick a chapter with a little of everything. John 3 has notes in the CUV; Psalm 23 has a
title. Listen to it, and decide the points below. Later, step 7's Chinese check reports
which notes and titles the recognizer heard, which confirms the choices.

- **What the narrator reads besides the verses:** a chapter announcement, such as
  约翰福音第三章 or "Capítulo 3"; psalm titles; footnotes; section headings.
- **How to write the text for the model.** MMS_FA takes lowercase Latin letters. Chinese
  goes in as toneless pinyin or jyutping. For another non-Latin script, use the
  [uroman](https://github.com/isi-nlp/uroman) romanizer, as torchaudio's MMS_FA tutorial
  does.

Anything the narrator always reads goes in as text. Anything they may or may not read
becomes a star token, which matches any speech or none. Anything they never read can be
left out, as the RV1909's section headings are.

- **Notes:** the Cantonese narrator reads the CUV's notes, so they're text. The Mandarin
  narrator doesn't, so they're stars.
- **Announcements:** the Chinese announcement is text. The Spanish one is left to the
  chapter's opening star.

### 3. Add the narrator to the scripts

Each script names its narrators near the top:

- **`download.py`:** add it to `NARRATORS`, with its manifest
  (`constants/<Name>AdventistAudioManifest.ts`, with files named
  `<PREFIX>_B<book>C<chapter>.mp3`).
- **`align.py`:**
  - `TEXT`: the bundled text it reads.
  - `romanize`: the romanizer.
  - `NOTES_SPOKEN`, `verse_words`, and `heading_words`: step 2's rules.
- **`finish.py`:** `TEXT`.
- **The check scripts:**
  - `spot_check_chinese.py` or `spot_check_spanish.py`, adapted for another language.
  - `check_verse_times.py` and `listen.py`: `TEXT`, whether the narrator is Chinese, and
    Whisper's `language`. `check_verse_times.py` also has `NOTES_SPOKEN`.

The narrator's name becomes its folder in `assets/bible/audio-timings/`.

### 4. Download every recording

```bash
python -I scripts/bible-audio-alignment/download.py <repo> <work-dir>
```

It downloads one file at a time, with a short pause between them, as hosted. It records
each file's URL, size, and SHA-256 in `<work-dir>/audio/<narrator>/sources.jsonl`. It
keeps files already downloaded, so it can be stopped and started again.

### 5. Align every chapter

```bash
python -I scripts/bible-audio-alignment/align.py <repo> <work-dir> <narrator>
```

It writes one result per chapter to `<work-dir>/align/<narrator>/<BOOK>/<chapter>.json`,
skipping chapters already done. `MAX_CHAPTERS=100` limits a run, so the work can be done
in batches.

`snap.py` then corrects the aligner's starts using the recording's pauses:

- **A start already where speech resumes after a pause** stays.
- **A start at the end of the verse before, or in the pause after it,** moves to where
  speech resumes.
- **Any other start more than 0.5 s from where speech resumes** moves to the nearest such
  place within 1.5 s, but not to before the verse before it ends.
- **A start with no pause nearby** stays where the aligner put it.

To change the rule, edit `snap.py`, then run `resnap.py <work-dir> <narrator>`. It
applies the rule again in minutes, without the speech model.

### 6. Write the app's files

```bash
python -I scripts/bible-audio-alignment/finish.py <repo> <work-dir> <narrator>
node scripts/write-bible-asset-index.mjs
```

- **The times:** it writes `assets/bible/audio-timings/<narrator>/`.
- **The sources:** it writes `scripts/bible-audio-timing-sources/<narrator>.json`.
- **A report:** it writes `<work-dir>/report/<narrator>.md`.
- **Rejected chapters:** a chapter gets no times if it failed to align, has the wrong
  number of verses, has starts that don't increase, or has a verse 1 that starts too late.
  The report lists those, and verses to check.
- **Verses that only say 見上節:** the CUV joins some verses into the one before, and the
  later number holds only 見上節 ("see the verse before"). The narrators skip it, so it
  gets no time, and the reader keeps the verse before marked.
- **Opening phrases before a colon:** a verse that opens with up to four words and a
  colon (24 characters at most), such as "Y dijo:", keeps the aligner's start if the pause
  rule moved it more than 0.5 s later. The narrator reads the phrase straight on from the
  verse before, so the pause the rule found is the one after the phrase. This kept 110
  Spanish starts. The recognizer heard the opening of 98 of them, and 97 are within 0.5 s
  of it. The last, Acts 13:10 ("Dijo:"), is one of step 8's false alarms.
- **Corrections:** `corrections.json`, next to the scripts, holds starts checked by ear
  (step 8): mostly ones found wrong, and a few found right. Each chapter's entry says why,
  and has the recording's SHA-256, as in `scripts/bible-audio-timing-sources/`. `finish.py` applies the entry
  only while the recording still matches. The report lists any entry it skipped. Check
  those chapters again. An entry looks like this:

  ```json
  "PRO 5": {"why": "Verses 11 and 12 are read twice; they start at the first reading.",
            "sha256": "…", "starts": {"11": 90.2, "12": 97.58}}
  ```

  A start can be `null`, for a verse the recording leaves out.

### 7. Check against a recognizer

```bash
mkdir -p <work-dir>/spot
python -I scripts/bible-audio-alignment/spot_check_chinese.py <repo> <work-dir> <narrator> 40 <work-dir>/spot/<narrator>.json
python -I scripts/bible-audio-alignment/spot_check_harm.py <work-dir> <narrator>
```

A recognizer transcribes 40 random chapters. The Chinese check also adds up to 10 that
the report flagged. Each verse's first heard word is compared with its time.
`spot_check_harm.py` sorts the misses:

- early, while a pause is still going (harmless);
- early, while the verse before is still being read;
- late.

With SenseVoice (Chinese), aim for at least 99% within 0.3 s, and none late. Whisper's
word times are rougher, about ±0.3 s, so with it aim for 98% within 0.5 s. Then:

- **After changing a rule, check other chapters,** not the ones you tuned on, or the
  numbers will flatter the rule. The scripts pick chapters with a fixed seed
  (`random.Random(561)`), so change the seed for a new sample.
- **Check a large disagreement against the verses around it.** In a chapter that repeats
  a passage, such as Numbers 7, the recognizer's match can land on a later copy of the same
  words, and the time is right.

### 8. Check every verse

A sample can't find the rare verse that's badly off. Check every verse before calling a
narrator done:

```bash
MAX_CHAPTERS=50 python -I scripts/bible-audio-alignment/check_verse_times.py <repo> <work-dir> <narrator>
```

- **Batches:** it takes 5 to 10 seconds a chapter, so 2 to 3 hours a narrator. Each run
  transcribes up to `MAX_CHAPTERS` chapters, so run it again until every chapter is done.
- **Transcripts:** it keeps what the recognizer heard, and the recording's pauses, in
  `<work-dir>/heard/<narrator>/`. After a fix, `COMPARE_ONLY=1` compares again in under a
  minute, without a GPU.
- **Pauses:** a word can't start in a pause, so a heard time inside one counts as where
  speech resumes. Whisper often starts a word where the word before it ends, so for it a
  time less than 0.3 s before a pause counts the same way.
- **The report:** `<work-dir>/report/<narrator>-check.md` has the share of verses within
  0.3 s, and lists every verse more than 1 s off.
  - **First words heard:** most verses are checked by when the recognizer heard their
    first word, if it heard their first two in order (characters, in Chinese). A miss
    found this way gets a suggested start.
  - **Others:** the rest are checked against the nearest words it heard. A start can't
    be more than 1 s before the last heard word of the verse before, or more than 1 s
    after the first heard word of its own. Such a miss has no suggested start.
  - **Doubtful:** a miss whose heard time lies outside the verses around it. These are
    usually the recognizer's mistake, such as a repeated passage.
  - **Checked by ear:** a miss with an entry in `corrections.json` is listed apart.

The recognizer is wrong about some misses, so check each one before changing it. Open the
recording at both times, or transcribe the seconds around them:

```bash
python -I scripts/bible-audio-alignment/listen.py <repo> <work-dir> <narrator> EXO:10:231-246
```

It prints the app's starts, where speech resumes after each pause, each syllable or word
heard with its time, and the loudness every 0.1 s. Checking the three narrators turned up
these kinds:

| What you hear | What to do |
|---|---|
| The aligner gave the verse before too little or too much time. | Use the suggested start. |
| The verse starts with a short phrase and a pause, such as 說、, 耶穌說、, or "Y á sus dos hijos;", and the pause rule moved the start past it. | Use the suggested start. `finish.py` already handles a phrase that ends in a colon. |
| The start is in the pause before the verse, but a second or more early. | Use the suggested start. |
| The narrator reads a verse, or its start, twice. | Start it at the first reading, and the next verse after the second. |
| The narrator announces a verse before reading it, such as 彌迦書第一章十四節. | Start the verse at the announcement. |
| The narrator reads the book's title and "Capítulo 1", or a psalm's title, and verse 1 starts during it. | Start verse 1 where speech resumes after it. |
| The recording leaves out verses. | Give them no time (null), and fix the verses after. |
| The recognizer matched the chapter announcement, a psalm title, or a repeated passage, such as "los hijos de" in a list. | Nothing: the time is right. |
| The recognizer left out words, or put a verse's first word in the chapter announcement. | Nothing: the time is right. Whisper does both. |

Add each fix to `corrections.json` with a short reason, run `finish.py` (step 6), and
compare again. A time that was right can go in too, unchanged, so the next check lists it
as checked by ear. With Whisper, expect dozens of misses that aren't the app's. The
Spanish check still lists 76, and each was looked at. They're the last two kinds, and a few
verses that open with one short word before a pause, such as "Dijo:", which the 0.3 s rule
above moves past.

### 9. Use it in the app

- **The narrator mapping:** in `services/BibleAudioTimings.ts`, map the translation and
  narrator to the new folder.
- **The tests:** in `test/bible-audio-timings.test.ts`:
  - add `[narrator, text folder]` to `CHURCH_NARRATORS`;
  - pin a verse or two the recognizer confirmed, as John 3:1 and 3:16 are.

  The test expects all 1,189 chapters timed, so a chapter `finish.py` rejected fails it
  until it's fixed.
- **The docs:** add the accuracy numbers to
  [Bible integration §4.7](../feature_designs/bible_integration_design.md#47-the-verse-being-read-aloud-done).
- **A real device:** play a chapter on an Android emulator or a phone, and check that the
  bar marks the right verse.
