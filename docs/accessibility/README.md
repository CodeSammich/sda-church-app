# Accessibility Guidelines

This project uses WCAG 2.1 Level AA as its practical accessibility baseline. The
linked U.S. Department of Justice guide explains requirements for state and local
governments; it is a useful reference, but it does not by itself determine which
ADA provisions apply to this church app. This document describes design intent,
not a legal certification or a claim of complete WCAG conformance.

## Key points

- Keep text readable and functional when resized to 200%.
- Reflow content on a 320 CSS-pixel-wide viewport without losing information or
  requiring two-directional scrolling, except where a two-dimensional layout is
  essential.
- Preserve complete labels and instructions. Wrap or rearrange controls instead
  of clipping important text.
- Provide accessible names for controls, text alternatives for meaningful images,
  visible focus, sufficient contrast, and keyboard and screen-reader operation.
- Keep touch targets comfortably usable. This project generally targets at least
  44 by 44 CSS pixels even though that size is beyond the WCAG 2.1 AA minimum.
- Treat automated checks as a starting point. Test manually with browser zoom,
  enlarged system text, narrow phone widths, keyboard navigation, and screen
  readers.

## Text size

The app has its own **Text size** setting (100% to 200%, under You → Settings) and
also follows the phone's text size. The two multiply:

- Page content follows both. When together they would pass 3.2×
  (`MAX_COMBINED_TEXT_SCALE` in `constants/AppPreferences.ts`), the app's part gives
  way, in 5% steps and never below 100%. Either setting used on its own applies in
  full.
- The header, the tab bar, and the Bible reader's controls follow the phone's text
  size only up to 1.35× (`HEADER_MAX_FONT_SCALE` in `hooks/useGlobalHeaderHeight.ts`,
  passed to React Native as `maxFontSizeMultiplier`). Past that, the accessibility
  sizes enlarge page content but not these bars. The app's own setting still applies
  to them: in full to the header, and up to 130% to the tab bar and the Bible
  reader's controls.
- `npm run check:text-scale` (`scripts/check-text-scale-coverage.mjs`) fails on raw
  `fontSize` or `lineHeight` numbers in `app/`, `components/`, and `styles/`, and on
  any `maxFontSizeMultiplier` cap other than the header's. The **PR Unit Tests**
  workflow runs it.

## Screen readers (VoiceOver and TalkBack)

The app uses React Native's accessibility props rather than web-only ARIA:

- Controls set `accessibilityRole`, and icon-only buttons carry an
  `accessibilityLabel`, as the Bible reader's Share and Cancel buttons do. Selected
  states use `accessibilityState`, as on the bulletin's Queens and Brooklyn tabs.
- An `accessibilityHint` explains a result that isn't obvious, such as the
  bulletin's staff-only schedule sheet.
- Purely visual parts, such as the switch drawing inside a menu card, are hidden
  with `accessibilityElementsHidden` and
  `importantForAccessibility="no-hide-descendants"`, so a control is read once.
- Text that changes in place, such as the Bible reader's selected-verse count, sets
  `accessibilityLiveRegion`. React Native supports that prop only on Android.

## Bible reader scaling

The Bible reader gives reading content and fixed interface controls different
scaling behavior:

- Scripture, headings, footnotes, original-language text, and other reading
  content honor the full in-app text preference from 100% through 200%, until the
  3.2× combined cap above.
- The in-app preference scales fixed Bible controls only through 130%, preventing
  the header and bottom dock from covering most of a phone viewport.
- Browser zoom is not capped. The phone's text size enlarges reading content in
  full, but the header and dock controls follow it only up to 1.35×. When controls
  need more space, they reflow and the dock remains scrollable.
- Interactive controls retain their accessible names and minimum touch areas even
  when their visual labels use the compact control scale.

This split keeps the text people came to read fully adjustable while keeping the
reader operable at the largest in-app setting.

## References

- [ADA.gov small entity compliance guide](https://www.ada.gov/resources/small-entity-compliance-guide/)
- [WCAG 2.1, Success Criterion 1.4.4: Resize Text](https://www.w3.org/TR/WCAG21/#resize-text)
- [WCAG 2.1, Success Criterion 1.4.10: Reflow](https://www.w3.org/TR/WCAG21/#reflow)
- [WCAG 2.1 standard](https://www.w3.org/TR/WCAG21/)
