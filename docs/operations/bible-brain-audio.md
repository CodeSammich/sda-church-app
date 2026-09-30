# Cantonese Bible audio (Bible Brain Apps Script)

Cantonese narration for the Chinese Union Version, from Faith Comes By Hearing (FCBH)
through its Bible Brain API (#241). It reaches the app through a small Apps Script web
app the church runs, which keeps FCBH's API key out of the app.

**Status:** built but **off**. The app ships with the feature turned off, and it stays
off until an IT administrator deploys the script and completes
[Before turning it on](#before-turning-it-on). The license terms it follows are in
[LEGAL.md](../LEGAL.md#bible-brain-api-license-faith-comes-by-hearing-planned-not-in-use).

**Why Apps Script:** it's covered by Google Workspace for Nonprofits, which has no
payment method, so it can never cost money. It's also a service the church already
runs for the bulletin, so there's nothing new to hand over. A Cloudflare Worker was
considered first and dropped: Cloudflare holds the church's only card
([Payment methods](../architecture.md#payment-methods)).

## Contents

- [How it works](#how-it-works)
- [Cost and limits](#cost-and-limits)
- [How long FCBH's links last](#how-long-fcbhs-links-last)
- [Before turning it on](#before-turning-it-on)
- [Deploying the script](#deploying-the-script)
- [Checking it works](#checking-it-works)
- [Turning it on in the app](#turning-it-on-in-the-app)
- [Turning it off](#turning-it-off)

## How it works

1. In the Bible, on the CUV or CUVS text, the narrator list gains
   **粵語 (Faith Comes By Hearing)** after the Mandarin narration, for chapters FCBH
   has recorded.
2. The app knows each Cantonese chapter by the script's address for it,
   `…/exec?fileset=<id>&chapters=MAT.1`, which never changes.
3. When someone presses Play, the app asks the script for the links of that chapter
   and the ones it would queue after it, in one request per fileset. The script asks
   Bible Brain for each chapter, with the key attached, and answers with FCBH's
   signed links. The audio itself streams straight from FCBH's servers; the script
   never downloads or stores it.
4. The app keeps the links in memory, never on the phone's storage, and queues only
   chapters whose links will still work when they finish playing. A link that fails
   is forgotten, and the next Play looks it up again.
5. While Cantonese is the narrator, FCBH's copyright notice appears under the
   chapter, and the lock screen names Faith Comes By Hearing as the source.

The code is `apps-script-bible-audio/BibleAudio.gs` and, in the app,
`services/BibleBrainAudio.ts`. What the script allows:

| Rule | Why |
| --- | --- |
| Only chapter links, a fileset's copyright notice, and a health check | FCBH's license forbids a "proxy distribution network"; nothing else of Bible Brain is reachable through it. |
| Only filesets in the `ALLOWED_FILESETS` property | The same; an empty list refuses everything. |
| Only real books and chapters, 30 at most per request | A request can't be bent into another Bible Brain endpoint. |
| Never downloads or stores anything | The license forbids caching FCBH content. |
| Never returns the key or an error | An Apps Script error can include the request, and with it the key. |
| The key only in Script Properties | The license forbids sharing it; it's never in the app, the repository, or an answer. |

Two things a Worker could do that Apps Script can't: limit which websites use it from
a browser, and limit requests per address. Anyone who finds the address can look up
links for the allowlisted filesets, which is the same audio FCBH's own apps play. The
daily quotas below are the ceiling.

The Mandarin narration still covers every chapter, which satisfies the license's
requirement for a fallback: FCBH can end the church's access at any time.

## Cost and limits

**Free, with no payment method anywhere:** Apps Script comes with Google Workspace for
Nonprofits, and Bible Brain is free for the church. The script runs as the account
that deploys it, and uses that account's
[daily quotas](https://developers.google.com/apps-script/guides/services/quotas):

| Apps Script limit (Workspace account) | This script's use |
| --- | --- |
| 100,000 URL Fetch calls a day | One per chapter looked up. A Play looks up the chapter and up to 23 after it; later presses reuse links that still work. |
| 30 simultaneous executions | One per request, each taking a second or two |
| 6 minutes per execution | A few seconds |

A rough estimate: 50 people each pressing Play on Cantonese three times a day is
3,600 calls, under 4% of the daily limit. At the limit, lookups fail until the quota
resets: Cantonese doesn't start, and the Mandarin narration keeps working.

**Deploy it from a church account other than the one that runs the bulletin's
script,** so the two never share quotas or executions.

**It's slower to start than the other recordings.** The bulletin's script answers in
about 1.5 seconds, or 5.7 seconds when it hasn't run for a while (*measured*). This
one adds Bible Brain's lookups, which run in parallel, so pressing Play on Cantonese
takes a few seconds before the audio starts. Chapters after the first are already
looked up.

FCBH doesn't publish a request limit, and may throttle heavy use.

## How long FCBH's links last

Each link FCBH returns expires. [The discovery script](#finding-the-fileset-ids)
prints how long, and it decides how the queue behaves:

- **An hour or more:** a Play queues up to 24 chapters, as it does for the Mandarin
  narration.
- **Less:** the app queues only the chapters whose links will outlast them. On
  Android and on the web, the queue refills as each chapter starts. On an iPhone, it
  plays to the end of the queue and stops; pressing Play again continues.
- **No expiry in the link:** the app assumes 30 minutes.

## Before turning it on

- [ ] **FCBH's answers.** The church asked FCBH whether a private, app-only proxy is
  acceptable under its proxy clause, and whether non-audio answers may be cached
  (#241). Wait for a yes to the first. For the second, ask specifically about the
  app keeping each chapter's link in memory until that chapter plays, at most for
  the link's own lifetime.
- [ ] **The exact recording.** Run the discovery script below with the key. Listings
  suggest FCBH's Cantonese audio is a dramatized New Testament of the *Cantonese
  Union Version*, whose wording may differ from the Mandarin CUV text on screen.
  Listen to a few chapters against the CUV text and decide whether that's acceptable,
  or whether the narrator needs a note.
- [ ] **How long links last.** Note what the discovery script prints; see
  [How long FCBH's links last](#how-long-fcbhs-links-last).
- [ ] **FCBH's notice.** The discovery script prints each fileset's copyright text.
  Copy it exactly into the app (see [Turning it on in the app](#turning-it-on-in-the-app)).
- [ ] **Privacy.** Add Faith Comes By Hearing, and Google for the script, to the
  providers in `public/privacy-policy.html` and the in-app privacy screen, with the
  same wording as the other audio hosts: they see a request's IP address, and the app
  sends no personal data. Update the architecture's third-party table and diagram
  (`docs/architecture.md`, `docs/diagrams/app-dependencies.mmd`).
- [ ] **Store listings.** Add Cantonese to the audio line in the descriptions, and
  remove it from [What not to claim](store-listing.md#what-not-to-claim).
- [ ] **Monitoring.** Add the `?health` check and one sampled chapter lookup to
  `test/integration/external-dependencies.mjs`.
- [ ] **Devices.** On a real iPhone and Android phone: pick the Cantonese narrator on
  a New Testament chapter, play across a chapter boundary, lock the screen, and check
  the notice under the chapter. On an Old Testament chapter, the Cantonese narrator
  shouldn't appear if that testament has no fileset.

## Deploying the script

It's one file, deployed by hand. Signed in to a church Google account (not the one
that runs the bulletin's script):

1. Open [script.google.com](https://script.google.com), choose **New project**, and
   name it **Bible Brain audio**.
2. Replace the contents of `Code.gs` with `apps-script-bible-audio/BibleAudio.gs`
   from the repository.
3. In **Project Settings**, tick **Show "appsscript.json" manifest file in editor**,
   then replace that file's contents with `apps-script-bible-audio/appsscript.json`.
4. In **Project Settings → Script Properties**, add:
   - `BIBLE_BRAIN_KEY`: FCBH's key;
   - `ALLOWED_FILESETS`: the fileset IDs the app uses, separated by commas.
5. Choose **Deploy → New deployment**, type **Web app**, **Execute as: Me**, **Who has
   access: Anyone**. Google asks for one permission, to connect to an external
   service. Copy the **Web app URL**, which ends in `/exec`.
6. Share the project with the other administrators as editors, and no one else.

**The key:** anyone who can edit the project can read Script Properties, so only
administrators edit it. The key never goes in the repository, the app, an issue, or
a chat. If it may have leaked, ask FCBH for a new one and replace the property; no
app update is needed.

**Changing the code later:** paste the new file, then **Deploy → Manage deployments →
Edit → Version: New version**. Editing the existing deployment keeps its address; a
new deployment would get a new one, which the app doesn't know.

### Finding the fileset IDs

```sh
read -rs BIBLE_BRAIN_KEY && export BIBLE_BRAIN_KEY   # paste the key; it isn't shown or saved in history
node scripts/bible-brain-discover.cjs
unset BIBLE_BRAIN_KEY
```

It lists Bible Brain's Cantonese (`yue`) Bibles and their filesets. For each audio
fileset, it checks Matthew 1 and Genesis 1, says how long their links last, prints the
copyright notice, and ends with the line to paste into `ALLOWED_FILESETS`.
`--language cmn` does the same for Mandarin. It only reads from Bible Brain, and never
prints the key or a link.

## Checking it works

Apps Script answers through a redirect, so `curl` needs `-L`:

```sh
SCRIPT='https://script.google.com/macros/s/…/exec'
curl -sL "$SCRIPT?health"                                 # {"ok":true,"configured":true}
curl -sL "$SCRIPT?fileset=<id>&chapters=MAT.1,MAT.2"      # a link and length for each
curl -sL "$SCRIPT?copyright=<id>"                         # FCBH's notice
curl -sL "$SCRIPT?fileset=ENGESVN2DA&chapters=MAT.1"      # {"error":"Unknown fileset."}
```

## Turning it on in the app

In `constants/ExternalLinks.ts`, fill in `BIBLE_BRAIN_AUDIO`:

- `scriptUrl`: the web app's address, ending in `/exec`;
- `cantoneseFilesets`: the New Testament fileset, and the Old Testament one if FCBH
  has it (leave a testament empty if not);
- `cantoneseNotice`: FCBH's copyright text, exactly as the discovery script prints it.

That ships with the next release. Tests in `test/bible-audio-cantonese.test.ts` cover
the addresses, the lookups, and the queue; `test/bible-audio-apps-script.test.ts`
covers the script.

## Turning it off

- **In the app:** set `scriptUrl` back to `''`. The Cantonese narrator disappears in
  the next release; saved choices fall back to the Mandarin narration.
- **At once, for every installed app:** empty the `ALLOWED_FILESETS` property, which
  takes effect immediately without redeploying, or archive the deployment. Cantonese
  chapters then fail to start; the Mandarin narration is unaffected.
- **If FCBH ends access:** do both, and delete the `BIBLE_BRAIN_KEY` property.
