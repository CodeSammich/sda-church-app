import {
  persistTextScalePreference,
  TEXT_SCALE_STORAGE_KEY,
} from '@/constants/AppPreferences';

describe('text scale storage ordering', () => {
  it('persists successfully before updating visible state', async () => {
    const events: string[] = [];
    const storage = {
      setItem: jest.fn(async (key: string, value: string) => {
        events.push(`stored:${key}:${value}`);
      }),
    };

    await persistTextScalePreference(storage, 1.35, (scale) => {
      events.push(`visible:${scale}`);
    });

    expect(events).toEqual([
      `stored:${TEXT_SCALE_STORAGE_KEY}:1.35`,
      'visible:1.35',
    ]);
  });

  it('does not update visible state when persistence fails', async () => {
    const onPersisted = jest.fn();
    const storage = {
      setItem: jest.fn().mockRejectedValue(new Error('storage unavailable')),
    };

    await expect(
      persistTextScalePreference(storage, 1.5, onPersisted),
    ).rejects.toThrow('storage unavailable');
    expect(onPersisted).not.toHaveBeenCalled();
  });
});
