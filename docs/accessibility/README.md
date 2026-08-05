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

## Bible reader scaling

The Bible reader gives reading content and fixed interface controls different
scaling behavior:

- Scripture, headings, footnotes, original-language text, and other reading
  content honor the full in-app text preference from 100% through 200%.
- The in-app preference scales fixed Bible controls only through 130%, preventing
  the header and bottom dock from covering most of a phone viewport.
- Browser zoom and operating-system font scaling remain available and uncapped.
  When they require more space, controls reflow and the dock remains scrollable.
- Interactive controls retain their accessible names and minimum touch areas even
  when their visual labels use the compact control scale.

This split keeps the text people came to read fully adjustable while keeping the
reader operable at the largest in-app setting.

## References

- [ADA.gov small entity compliance guide](https://www.ada.gov/resources/small-entity-compliance-guide/)
- [WCAG 2.1, Success Criterion 1.4.4: Resize Text](https://www.w3.org/TR/WCAG21/#resize-text)
- [WCAG 2.1, Success Criterion 1.4.10: Reflow](https://www.w3.org/TR/WCAG21/#reflow)
- [WCAG 2.1 standard](https://www.w3.org/TR/WCAG21/)
