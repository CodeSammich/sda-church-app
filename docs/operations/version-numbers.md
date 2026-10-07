# Version numbers

**Maintainers change one number: the version, such as `0.40.0`.** Everything else
follows from it. Never set Android's `versionCode` or iOS's `buildNumber` in
`app.json`; the builds refuse to run if you do.

## The three numbers

| Number | Example | Who sets it | Who sees it |
| --- | --- | --- | --- |
| **Version** (`version` in `package.json` and `app.json`) | `0.40.0` | A maintainer, once per release, with `npm run sync-version` | Everyone: the App Store, Google Play, the phone's app settings |
| **Android `versionCode`** | `40000` | Computed from the version | Only Play Console |
| **iOS build number** (`CFBundleVersion`) | `40000` | Computed from the version | Only TestFlight testers ("0.40.0 (40000)") and App Store Connect |

The app itself never shows the build number.

## The formula

```text
build number = major × 1,000,000 + minor × 1,000 + patch
```

| Version | Build number |
| --- | --- |
| `0.39.0` | `39000` |
| `0.40.0` | `40000` |
| `0.40.1` | `40001` |
| `0.41.0` | `41000` |
| `1.0.0` | `1000000` |
| `1.0.1` | `1000001` |
| `1.2.3` | `1002003` |

Each part of the version gets three digits, so:

- **A higher version always gets a higher build number**, and no two versions share
  one, as long as the minor and patch numbers stay at 999 or below. The build refuses
  a version like `0.1000.0` rather than let it overlap `1.0.0`.
- **You can read the version back from the number**: `40001` is `0.40.1`, and
  `1002003` is `1.2.3`.
- **There's room to grow**: Google Play's limit, 2,100,000,000, isn't reached until
  version `2100.0.0`.

To see the build number for any version, run
`node scripts/store-build-number.cjs 0.41.0`.

## Why a build number exists at all

The stores need a number that changes with every upload:

- **Google Play** requires each upload's `versionCode` to be higher than every earlier
  upload of the app, forever. That's how Android decides that one build is an update
  to another. Play never accepts a lower number, even after deleting a release.
- **Apple** requires every upload of the same version to have a different build
  number.

Users don't see it; the stores show them the version.

## Why it's computed, not bumped by hand

Every merge to `main` is a release, and every release has a new, higher version:
**PR Version Check** fails a release PR whose version isn't higher than `main`'s. So
one release is one version is one build number, automatically. (The one exception: a
PR from `release-candidate` may keep `main`'s version `x.y.z` while no `vx.y.z` tag
exists, so a release that was never tagged can be recovered.)

A counter kept by hand needs someone to remember it in every release, in both stores,
and a forgotten bump only shows up as a rejected upload. Computing it from the version
removes that job entirely.

## Where it happens

| File | What it does |
| --- | --- |
| `scripts/store-build-number.cjs` | The formula and its limits |
| `app.config.js` | Gives the number to Expo, so every native build, local or in CI, gets it |
| `scripts/build-android-native.mjs` | Refuses to build if `app.json` has a hand-set `versionCode` |
| `.github/workflows/native-ios-build.yml` | Passes the number to Xcode, and refuses a hand-set `buildNumber` |
| `.github/workflows/pr-check.yml` | **PR Version Check**: fails a release PR whose version isn't higher than `main`'s |
| `test/store-build-number.test.ts` | Checks the formula, its order, and its limits |

## Common situations

- **Making a release:** nothing extra. Set the version with
  `npm run sync-version -- --version x.y.z` in a pull request into `release-candidate`.
- **Fixing something after a release:** make a patch release. `0.40.1` becomes
  `40001`.
- **Apple rejected an uploaded build:** its build number still counts as used, so the
  fix needs a new version, such as a patch release.
- **Rerunning a build of the same release:** it gets the same build number, and the
  stores refuse a duplicate. The upload jobs report that the build is already there,
  and succeed.
- **The 0.39.0 upload made by hand:** it used `versionCode` 1, which is lower than
  `40000`, so it doesn't get in the way.
- **1.0.0 and after:** 1.0.0, the first public release, is `1000000`, higher than any
  `0.x` release, and `1.0.1` is `1000001`. Nothing special was needed.
- **A release that doesn't go to the stores,** such as a docs-only patch: its builds
  can be rejected at the `production` approval, so nothing is uploaded. Its build
  number is then never used, which is fine. The stores need each upload to have a new
  number (and Google Play a higher one), not consecutive numbers; the formula already
  skips most numbers, such as from `40001` to `41000`. The next release that is
  uploaded gets its own, higher number.
- **Submitting to the App Store:** the App Store version you submit must match the
  build's version, so set it to the release you're submitting, such as `0.40.0`.

## Don't change the formula

Google Play never accepts a lower `versionCode`. A new formula would have to give
every future version a higher number than the current formula gave the last upload,
and a mistake can't be undone. Keep this one.
