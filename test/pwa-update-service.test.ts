import {
  APP_UPDATE_CACHE_BUSTER,
  fetchDeployedAppVersion,
  getUpdateReloadUrl,
  isPwaUpdateCheckDue,
  parseServiceWorkerVersion,
  waitForServiceWorkerInstallation,
} from '@/services/PwaUpdateService';

describe('PWA update navigation', () => {
  it('preserves the current route and query while replacing the CDN cache buster', () => {
    const first = getUpdateReloadUrl(
      'https://app.nyccsda.org/home/bulletin?week=next',
      123,
    );
    const second = getUpdateReloadUrl(first, 456);
    const url = new URL(second);

    expect(url.pathname).toBe('/home/bulletin');
    expect(url.searchParams.get('week')).toBe('next');
    expect(url.searchParams.get(APP_UPDATE_CACHE_BUSTER)).toBe('456');
    expect(url.searchParams.getAll(APP_UPDATE_CACHE_BUSTER)).toHaveLength(1);
  });

  it('throttles persisted automatic checks while allowing them after one hour', () => {
    const oneHour = 60 * 60 * 1000;
    expect(isPwaUpdateCheckDue(0, 1000, oneHour)).toBe(true);
    expect(isPwaUpdateCheckDue(1000, 1000 + oneHour - 1, oneHour)).toBe(false);
    expect(isPwaUpdateCheckDue(1000, 1000 + oneHour, oneHour)).toBe(true);
  });

  it('reads the deployed version from a no-cache service-worker request', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      text: async () => "const VERSION = '0.25.12';",
    })) as unknown as typeof fetch;

    expect(parseServiceWorkerVersion("const VERSION = '0.25.11';")).toBe(
      '0.25.11',
    );
    await expect(fetchDeployedAppVersion('/sw.js', fetcher)).resolves.toBe(
      '0.25.12',
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/sw.js?__appUpdate='),
      { cache: 'no-store' },
    );
  });

  it('waits for an installing update worker before allowing activation', async () => {
    let stateChangeListener: (() => void) | undefined;
    const worker = {
      state: 'installing',
      addEventListener: jest.fn((_event, listener) => {
        stateChangeListener = listener as () => void;
      }),
      removeEventListener: jest.fn(),
    } as unknown as ServiceWorker;

    const installed = waitForServiceWorkerInstallation(worker);
    expect(stateChangeListener).toBeDefined();

    Object.defineProperty(worker, 'state', { value: 'installed' });
    stateChangeListener?.();

    await expect(installed).resolves.toBe(worker);
    expect(worker.removeEventListener).toHaveBeenCalledWith(
      'statechange',
      expect.any(Function),
    );
  });
});
