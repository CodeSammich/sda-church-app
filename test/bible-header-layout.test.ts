import { shouldStackBibleControls } from '@/hooks/useGlobalHeaderHeight';

// The Bible header's translation button shares a row with the icon buttons
// whenever they fit. An iPhone with larger system text used to get a stacked
// header even when everything fit on one row.
describe("the Bible header's controls", () => {
  const phone = { rowWidth: 380, iconButtonCount: 2, iconButtonSize: 56 };

  it('share one row when the translation button fits beside the icon buttons', () => {
    // 212 + 2 × (56 + 8) + 12 = 352, within 380.
    expect(shouldStackBibleControls({ ...phone, translationButtonWidth: 212 })).toBe(false);
  });

  it('stack when they would overflow the row', () => {
    expect(shouldStackBibleControls({ ...phone, translationButtonWidth: 240, rowWidth: 330 })).toBe(true);
  });

  it("stack rather than cut off a translation name past the button's maximum width", () => {
    expect(
      shouldStackBibleControls({ ...phone, rowWidth: 1000, translationButtonWidth: 260 }),
    ).toBe(true);
  });

  it('start on one row until both widths are measured', () => {
    expect(shouldStackBibleControls({ ...phone, translationButtonWidth: 0 })).toBe(false);
    expect(shouldStackBibleControls({ ...phone, rowWidth: 0, translationButtonWidth: 500 })).toBe(false);
  });
});
