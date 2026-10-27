# Chinese Union Version 1919 text: sources and checks

The record behind the app's Chinese Union Version, the public-domain 1919 text that
replaced the 1988 New Punctuation edition in 1.4.0 (#517). The licensing summary is in
[LEGAL.md](../../LEGAL.md#chinese-union-version-text-1919). These notes say where the
text came from and how it was checked, so it can be rebuilt or re-checked later.

## Sources

| Source | What | Used for |
| --- | --- | --- |
| [WordProject](https://www.wordproject.org/download/bibles/index.htm), `https://www.wordpocket.org/bibles/download_zip/big5_new.zip`, downloaded October 26, 2026 (SHA-256 `6ea298435a41e9737ca73b8952f2ffbe3495b11cd5412d69fc8a51ab8c6de849`) | The 1919 text in Traditional characters, one page per chapter | The app's text, through `scripts/build-cuv-1919.mjs` |
| [Wikisource, 聖經 (和合本)](https://zh.wikisource.org/wiki/聖經_(和合本)), read through its API on October 27, 2026; the revision of each book is in [`wikisource-revisions.json`](wikisource-revisions.json) | An independent transcription of the 1919 text, marked public domain (`{{Pd/1923}}`) | Finding WordProject's copying errors |
| The 1988 New Punctuation edition, from fetch(bible) (`cmn_cut`) | The text the app showed before | Only to break ties on wording, since it keeps the 1919 wording almost everywhere. None of its text is used. |

WordProject's Simplified Chinese download is a later edition (modern punctuation, 她),
so it isn't used. The Simplified text is the Traditional text converted with
`opencc-js` (Taiwan to Mainland), the same converter the app uses for pinyin.

## How the text was checked

1. **Character forms.** Wikisource keeps older forms (爲 裏 着 衆 衞 豫 脚 眞 羣).
   WordProject uses today's standard Traditional forms (為 裡 著 眾 衛 預 腳 真 群), which
   display on every phone, so the app keeps WordProject's. About 55 such pairs were
   checked by hand and folded together before comparing. Pairs that differ in meaning
   (記/紀, 畫/劃, 穀/榖, 克/剋) were not folded.
2. **Every verse compared.** Of 31,102 verses, 30,069 were the same in both copies.
   - **Punctuation only:** WordProject's characters with Wikisource's punctuation, which
     fixed stray 、, 。、, and modern commas.
   - **Wording:** the copy closer to the 1988 text won. Wikisource won 338 verses. They
     were real WordProject errors, such as 亞撒都該利雅 for 亞撒利雅, 撒拉篾 for 耶拉篾, a
     missing 神 or 們, and 麈土 for 塵土. WordProject won 306. Those are almost all
     variant spellings that weren't folded (叙/敘, 删/刪, 喇/啦), so WordProject's stayed.
   - **Ties:** 31 verses, reviewed by hand. They are variant characters that stayed
     as WordProject has them, apart from 牲扣 → 牲口 (Neh 2:12) and 原文是 → 原文作.
3. **Merged verses.** Where 1919 translated two verses as one, WordProject puts the text
   in the first and 見上節 ("see the verse above") in the second, and Wikisource leaves
   the first empty. WordProject's layout stays, since it reads better. The merged
   verses were compared separately, which found two more errors (Jdg 20:27, Pro 26:18).
   Job 3:2–3, which WordProject merged but 1919 keeps apart, was split back.
4. **Private-use characters.** WordProject has 11 placeholders (92 uses) for characters
   its font lacked. Wikisource shows which character each one is. Where that character
   is outside the Basic Multilingual Plane, which many phones can't display, the usual
   character is used: 𤏲 → 著, 𣎴 → 墩, 𧼮 → 趟. The others became 窯, 蔥, 韭, 灶, 噝,
   蹦, 騌, 撐.
5. **Titles.** Psalm 3's title was missing from WordProject's copy. Psalms 131 and 132
   used （） and [ instead of 〔〕, and 1 Chronicles 22 had a "(21:31)" marker as a title.
6. **Verse division.** 3 John 1:14–15 and Revelation 12:17–18 are split as in the 1988
   text and the BSB, so every chapter has the same number of verses as before. The
   1919 words don't change.

All 481 fixes are in `scripts/cuv-1919-corrections.json`, each with its reason
(`wording`, `punctuation`, `rare-character`, `title`, or `verse-division`) and the exact
WordProject text it replaces. The build fails if WordProject's copy changes under one.

## Checks that run with the tests

`test/cuv-1919-text.test.ts` checks the built text on every run:

- every verse of both scripts is numbered the same;
- there are no private-use or rare characters, no stray markers, and the full-width
  space appears only before 神;
- none of the errors above come back;
- every Han character in both scripts gets exactly one pinyin syllable, without
  shifting, as the reader shows it. Two rare characters needed readings added
  (`services/BiblePinyinService.ts`).

## Known differences left as they are

- One comma in Hebrews 11:6 (必須信有神，且), which both copies have.
- Variant spellings where WordProject and Wikisource differ but both are correct.
- 見上節 in the second verse of a merged pair, as described above.
