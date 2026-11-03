import { findChineseMissionSpotlight } from '@/features/sabbath-school/ChineseMissionSpotlight';

describe('the Chinese mission video on the web', () => {
  it("doesn't ask YouTube, since a browser can't read its feed from another site", async () => {
    const fetchText = jest.fn() as unknown as typeof fetch;

    await expect(findChineseMissionSpotlight(new Date(2026, 9, 31), fetchText)).resolves.toBeNull();
    expect(fetchText).not.toHaveBeenCalled();
  });
});
