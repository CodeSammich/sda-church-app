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
| [open-bibles](https://github.com/seven1m/open-bibles) `chi-cuv.usfx.xml` (SHA-256 `049e36ec3ee1b5c9bc2c8bfd2ca07f9f1f30398838f692d12ea38a092d41fe4b`) and `chi-cuv-simp.usfx.xml` (SHA-256 `bea9f6e4fd35b70a67e3978ce8b9dc0ad853078e67472653cf1b34f357ae3abf`), downloaded October 26 and 27, 2026 | A 1919-based copy in both scripts, marked public domain, with some spellings modernized (她, 吃, 啊) and speaker labels in the Song of Songs | A last check after the vote below, and the tests |
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
     fixed stray 、, 。、, and modern commas. One more was found later: a note in
     Jeremiah 46:20 closed with ） instead of 〕.
   - **Wording:** the copy closer to the 1988 text won. Wikisource won 337 verses. They
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
   1919 words don't change. Wikisource's copy has no John 7:53 and starts 8:1 with its
   words (於是各人都回家去了), so the vote at first copied them into 8:1 too. John
   keeps WordProject's division, which the 1988 text and the BSB share, and a test
   checks that no verse starts by repeating the verse before it.

7. **A fourth copy, checked last.** The vote above never used open-bibles. Wherever
   it and Wikisource agree on a word and WordProject differs, two 1919 copies outvote
   WordProject. That found 17 verses where the 1988 tiebreaker had kept WordProject's
   later wording: 記念 for 紀念 (9 verses), 不至 for 不致 (4), 何西阿 for 何希阿 (Numbers
   13:8), 貪慾 (Numbers 11:34), 甚麼 for 什麼 (a note in Matthew 19:17), and 自辯 for
   自辨 (Proverbs 31:8). It also fixed:
   - 珉雅珉 in 2 Chronicles 31:15, where WordProject's 玟雅玟 matches no copy:
     open-bibles and the 1988 text have 珉, and Wikisource 泯;
   - 挓挲 (spread out) in Job 39:19 and Jeremiah 4:31, where WordProject has 莎, a
     different character: Wikisource has 挱, an older form of 挲, and open-bibles 挲;
   - the note in Isaiah 11:1, 〔原文作墩〕, which the vote had dropped. WordProject has
     it with a private-use placeholder for 𣎴, and the first reading of Wikisource lost
     notes nested inside another template, so the two seemed to agree on no note.
     The tests now read Wikisource with the nesting handled.

   Where the two copies agree only on an older form of the same character (餬/糊,
   蹧/糟, 挂/掛, 啞吧/啞巴), the app keeps WordProject's form, as in step 1.
8. **The Simplified conversion.** The Simplified text is exactly the Traditional text
   converted, so it has the same words. Compared character by character with
   open-bibles' Simplified copy, where the two Traditional copies agree, the converter
   was wrong in 13 verses: Traditional writes 著 for both zhe (穿著, wearing) and zhù
   (著名, famous), and it left 著 in phrases such as 穿著白衣 (wearing white), and in
   按著名 (by name), 得著稱讚 (receive praise), and 遵著書, which it reads as the zhù
   words 著名, 著稱, and 著書. `services/BibleSimplifiedFixes.json` fixes them, for the text and
   for the pinyin, which had the same mistake with the 1988 text. Everything else
   that differs is open-bibles keeping older forms (毘, 邱, 彀, 窰), and five verses
   where it writes 着 for the 著 of 著名 and 著書.

After all this, of the 31,104 verses, 30,171 match both copies word for word, 720
match Wikisource alone (mostly where open-bibles modernizes a spelling), and 180 match
open-bibles alone (mostly where Wikisource has a slip of its own, such as 但 for 僅 in
Joshua 17:14 or an extra 所 in John 8:5). The other 33 are merged verses and the verse
divisions above, whose words match a copy across the verses involved.

All 501 fixes are in `scripts/cuv-1919-corrections.json`, each with its reason
(`wording`, `punctuation`, `rare-character`, `title`, or `verse-division`) and the exact
WordProject text it replaces. The build fails if WordProject's copy changes under one.

## Checks that run with the tests

`test/cuv-1919-witnesses.test.ts` checks the built text against the other copies on
every run. Wikisource's and open-bibles' text, verse by verse, is in
`test/fixtures/cuv-1919-witnesses`, as `scripts/cuv-1919-witnesses.mjs` downloads it:
Wikisource at the revisions in [`wikisource-revisions.json`](wikisource-revisions.json),
and open-bibles checked against the SHA-256 above. It compares wording only, by the rules
in `scripts/cuv-1919-fold.cjs`: Han characters, with older and newer forms of a character
counted as one, and the merged-verse notes 見上節 and 併於上節 counted as the same. It
checks that:

- every verse has the wording of Wikisource or open-bibles. A copying error in the app's
  text would have to be the same error, in the same verse, in a copy made separately;
- wherever the two copies agree with each other, the app agrees too, apart from merged
  verses and the places they divide verses differently;
- across each place the copies divide verses differently, the words match a copy, in
  order;
- the Simplified text is exactly the Traditional text converted, and each converted
  character matches open-bibles' Simplified copy where the Traditional copies agree.

`test/cuv-1919-text.test.ts` checks the built text on its own:

- every verse of both scripts is numbered the same;
- there are no private-use or rare characters, no stray markers, and the full-width
  space appears only before 神;
- none of the errors above come back, and no verse starts by repeating the one before;
- each 〔〕 note inside a verse is a footnote, and the verses printed wholly in 〔〕
  stay as text;
- every Han character in both scripts gets exactly one pinyin syllable, without
  shifting, as the reader shows it. Two rare characters needed readings added
  (`services/BiblePinyinService.ts`), and 著 reads zhù only where it means famous or
  writing.

## Known differences left as they are

- One comma in Hebrews 11:6 (必須信有神，且), which both copies have.
- Variant spellings where WordProject and Wikisource differ but both are correct.
- 見上節 in the second verse of a merged pair, as described above.
