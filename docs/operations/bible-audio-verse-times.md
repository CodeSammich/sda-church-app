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
    `audio/<narrator>/sources.jsonl`, and its result in `align/`. Then run steps 4 to 7:
    each step skips what's already done.
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
  consumer card, or about a minute on a CPU, and checking with a recognizer takes about
  15 seconds a chapter.
- **Python packages:** a virtual environment with `torch` and `torchaudio` 2.8 (the CUDA
  build), `numpy`, `imageio-ffmpeg`, and a romanizer for the language's script:
  `pypinyin` for Mandarin, `ToJyutping` for Cantonese, none for a Latin script. The checks
  also need `funasr` (SenseVoice, for Chinese) or `transformers` (Whisper, for other
  languages).
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
- **The check scripts:** `spot_check_chinese.py` or `spot_check_spanish.py`, adapted for
  another language.

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
- **Check every verse,** not just a sample, before calling a narrator done. #573 tracks
  adding that script here.

### 8. Use it in the app

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
