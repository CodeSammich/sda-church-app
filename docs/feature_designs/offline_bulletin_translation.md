# Offline Bulletin Translation: Bergamot Feasibility Decision

Last reviewed: 2026-08-09

Status: **Deferred; do not implement in the production app yet**

## 1. Decision Summary

Mozilla's Bergamot approach satisfies the desired privacy and operating-cost goals: text
is translated on the user's device, so the app would not need a metered translation API,
an API key, or a server that receives bulletin text. It is technically credible and is
used by Firefox Translations.

It is not currently a proportionate fit for this Expo application. The browser package is
stale relative to Mozilla's current Chinese models, the required model downloads are large
for a bulletin containing only a few short strings, and the browser WASM integration does
not provide native React Native support on iOS and Android. Shipping it now would either
make translation web-only or require a new, maintained native C++ integration and custom
mobile builds.

Do not add Bergamot to `package.json`, download its models, or automatically translate
bulletin fields without a new implementation review and device benchmarks.

## 2. Product Need and Scope

The proposed feature would fill a missing localized value for public worship content such
as:

- `bulletin.tithePurpose` (the offering/tithe purpose text); and
- a missing English or Chinese `location.sermonTitle` answer.

Machine output must be a fallback. It must never overwrite the submitted source or a
human-provided translation. Church terminology and short sermon titles are unusually
context-sensitive, so the source must remain available and generated text must be labeled
as machine translated for both visual and screen-reader users.

The existing form already accepts separate English and Chinese sermon titles. Human entry
remains the preferred solution. Tithe purposes are often recurring phrases, making a small,
church-reviewed local glossary a much cheaper and more reliable first fallback.

## 3. How Bergamot Works

[Bergamot Translator](https://github.com/browsermt/bergamot-translator) is a C++/Marian
translation engine exposed to browsers through WebAssembly. Mozilla's
[Translations overview](https://firefox-source-docs.mozilla.org/toolkit/components/translations/resources/01_overview.html)
confirms that translation runs locally and that models are directional and specific to a
language pair. English→Chinese, English→Traditional Chinese, and English→Spanish are
therefore separate downloads; one model cannot provide all three outputs.

The current models and metadata live in Mozilla's
[model registry](https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/db/models.json).
The former `firefox-translations-models` repository was archived in December 2025; the
[`mozilla/translations`](https://github.com/mozilla/translations) project and hosted
registry are now authoritative.

When a submission contains only a title, Bergamot does not look it up in a dictionary. It
runs a neural translation model. This differs from `BulletinHymnalService`, whose
title-only behavior searches a finite local hymn catalog.

## 4. Measured Download Footprint

The following totals were calculated on 2026-08-09 from the `Content-Length` metadata for
each released model, lexical-shortlist, and vocabulary artifact in Mozilla's production
registry. They exclude HTTP overhead and storage bookkeeping.

| Translation direction | Downloaded artifacts | Approximate total |
| --- | ---: | ---: |
| English → Simplified Chinese | 36,745,493 bytes | 35.04 MiB |
| English → Traditional Chinese | 36,402,857 bytes | 34.72 MiB |
| English → Spanish | 25,373,354 bytes | 24.20 MiB |

Mozilla's published Remote Settings record lists the Bergamot WASM engine at approximately
4.96 MB (about 4.73 MiB). Consequently:

- one Chinese target requires roughly 40 MiB of first-use downloads including the engine;
- both Chinese writing systems require roughly 75 MiB; and
- both Chinese targets plus Spanish approach 99 MiB.

The registry reports an uncompressed neural-model file of about 43.85 MB for each current
English→Chinese release. Runtime memory is higher than disk size because the engine needs
the model, vocabularies, shortlist, working buffers, input/output, and temporary copies.
Persistent caching prevents another network download; it does not eliminate model loading,
decompression, initialization time, CPU use, or peak memory on each new app process.

Firefox deliberately downloads its inference binaries and models separately rather than
inflating the initial browser installation. Its architecture also isolates inference in a
separate process because inference is performance- and memory-intensive and Android may
kill such a process under pressure. See Mozilla's
[inference architecture](https://firefox-source-docs.mozilla.org/toolkit/components/ml/architecture.html).

## 5. Compatibility With This App

### 5.1 PWA/web

The PWA could theoretically run Bergamot in a dedicated Web Worker. A production design
would need a pinned, reproducible WASM build compatible with the chosen model revision,
integrity hashes, progress/cancellation UI, storage-quota handling, and an explicit model
cache in IndexedDB or OPFS.

The existing service worker must not own the model cache. It caches every successful GET
in a release-versioned cache and deletes old release caches during activation. A model
stored there could be downloaded again after every app release and could evict ordinary
offline app resources. Model storage must have an independent lifecycle and a user-facing
delete control.

The published
[`@browsermt/bergamot-translator`](https://www.npmjs.com/package/@browsermt/bergamot-translator)
wrapper was last published roughly four years ago. Mozilla's current Firefox integration
has continued evolving its WASM/model compatibility, including CJK segmentation and newer
model formats. Installing that npm package is not sufficient evidence that the currently
released Chinese models will work safely in this Metro-built PWA.

### 5.2 Native Android and iOS

This repository uses Expo/React Native and Hermes for native builds. Bergamot's public
JavaScript integration targets a browser Worker and WebAssembly environment; it is not a
React Native module. A web-only implementation would create inconsistent bulletin behavior
between the PWA and installed native apps.

Native parity would require one of the following, neither of which currently exists in
this repository:

1. a maintained React Native Turbo/Expo native module that compiles and bridges Bergamot's
   C++ library for Android and iOS; or
2. a WebView-based translator with a separate browser runtime and storage system.

The first option requires custom development/production builds, ABI maintenance, model
file management, cancellation, threading, and physical-device testing. Expo documents
that custom native code requires development builds and rebuilding the native app. The
second option duplicates runtime overhead and is not recommended for a background data
transformation feature.

Relevant Expo guidance:

- [Add custom native code](https://docs.expo.dev/workflow/customizing/)
- [Switch from Expo Go to a development build](https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/)

## 6. Why Loading on Every Language Change Is Not Recommended

Changing the UI language is not consent to a roughly 25–35 MiB model download. It may also
happen accidentally or over metered mobile data. If this feature is revisited, language
change should only select the desired target; it should not fetch a model automatically.

The safer lifecycle is:

1. Continue showing the submitted source immediately.
2. Offer an explicit **Download offline translation** action with the exact download size,
   storage use, target language, and a cancel option.
3. Download only the requested direction, verify its hash, and persist it outside the
   release-versioned service-worker cache.
4. Initialize the engine lazily in a worker/native background thread only when a missing
   translation is visible.
5. Cache translated results by source text, source/target language, model revision, and a
   church-glossary revision.
6. Release the in-memory model after an idle period or memory warning, while retaining the
   on-disk model for later sessions.
7. Provide storage status, retry, and **Delete downloaded translation model** controls.

Short bulletin strings should be translated as one small batch after the model loads.
Repeatedly initializing a model once per field would be wasteful.

## 7. Recommended Near-Term Design

Use deterministic and human-reviewed data before local neural translation:

1. Keep the bilingual sermon-title form fields and preserve the existing source-language
   fallback when one is missing.
2. Add bilingual tithe-purpose fields to the schedule, or maintain a reviewed mapping for
   recurring offering-purpose phrases such as `Local Church Budget`.
3. Display the raw source when neither a human translation nor a reviewed glossary entry
   exists.
4. Never silently present a guessed ecclesiastical translation as submitted church data.

This approach is tiny, instant, offline, consistent across PWA/iOS/Android, and has no API
keys or recurring cost.

## 8. Reconsideration Gates

Bergamot may be reconsidered when all of the following are available:

- a maintained web wrapper compatible with Mozilla's currently released model format;
- a maintained Android/iOS integration or an explicit product decision to be web-only;
- physical low- and mid-range Android plus representative iPhone benchmarks for download,
  cold initialization, translation latency, peak memory, cancellation, and OS backgrounding;
- an opt-in download/storage UX that meets accessibility requirements;
- a reviewed glossary and visible machine-translation attribution;
- model/WASM license, redistribution, CDN-use, version pinning, and integrity review; and
- an acceptance budget approved before implementation (download size, disk use, peak RAM,
  cold-start latency, and failure behavior).

Until those gates are met, the production decision remains **deferred**.
