<!--
Title: "Release/x.y.z: Describe the change", with the target release branch's major
and minor version (or "Release/x.y.x: …"). CI rejects other titles.

Name every issue this touches, one per line: "Closes #" and the number for an issue
this finishes; "Part of #" or "Related to #" and the number for one it only advances.
The PR Linked Issue check needs at least one. See AGENTS.md and docs/CONTRIBUTING.md.
-->
Closes #

## What changed


## Key screens

<!--
If this changes what a screen shows or how it's laid out, update the key screens in
test/screens/screens.json, for every platform that captures them (the iPhone today,
and Android once it has key screens too), so each release PR's screenshots and
text checks cover it (see "Key screens" in docs/operations/native-builds.md):
- add the screen, or the variant that shows the change: dark, a larger text size, the
  iPhone's own largest text, or another language;
- add text checks that fail if it breaks: mustShowLines, mustNotShowLines, or
  variantRules for one variant;
- update appStore if the App Store screenshots should change.
Prefer a check on an existing shot to a new shot, since each shot lengthens every
release PR's run, and replace checks that no longer earn their place.
-->
- [ ] Key screens and their checks are updated, or this doesn't change what a screen shows.

## Tested

<!-- The commands you ran and their results, such as npm test and its count, and any Android or iOS build. -->
