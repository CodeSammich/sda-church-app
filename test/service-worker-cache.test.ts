import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// public/sw.js is a plain browser script, so the test runs it in a sandbox with a
// stand-in for the service worker's globals and calls the listeners it registers.

type Listener = (event: any) => void;

const SITE = 'https://app.example.org';

function loadServiceWorker(fetchImpl: (request: any) => Promise<any>) {
  const listeners: Record<string, Listener> = {};
  const stored: string[] = [];
  const cache = {
    put: jest.fn(async (request: { url: string }) => {
      stored.push(request.url);
    }),
  };
  const caches = {
    open: jest.fn(async () => cache),
    match: jest.fn(async () => 'stored copy'),
    keys: jest.fn(async () => []),
    delete: jest.fn(async () => true),
  };
  const sandbox = {
    self: {
      location: { origin: SITE },
      addEventListener: (type: string, listener: Listener) => {
        listeners[type] = listener;
      },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
    },
    caches,
    fetch: jest.fn(fetchImpl),
    URL,
  };
  const source = readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  vm.runInNewContext(source, sandbox);
  return { listeners, cache, stored, fetch: sandbox.fetch };
}

function fetchEvent(url: string, method = 'GET') {
  let answer: Promise<any> | undefined;
  const event = {
    request: { url, method },
    respondWith: jest.fn((value: Promise<any>) => {
      answer = value;
    }),
  };
  return { event, answer: () => answer };
}

function response(status: number) {
  return { status, clone: () => ({ status }) };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('web app service worker', () => {
  it("keeps a copy of the site's own files", async () => {
    const worker = loadServiceWorker(async () => response(200));
    const { event, answer } = fetchEvent(`${SITE}/_expo/static/js/app.js`);

    worker.listeners.fetch(event);
    await expect(answer()).resolves.toMatchObject({ status: 200 });
    await flush();

    expect(worker.stored).toEqual([`${SITE}/_expo/static/js/app.js`]);
  });

  it('leaves requests to other sites to the browser and keeps no copy', async () => {
    const worker = loadServiceWorker(async () => response(200));
    const { event } = fetchEvent('https://script.google.com/macros/s/example/exec');

    worker.listeners.fetch(event);
    await flush();

    expect(event.respondWith).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it.each([404, 500, 206])("doesn't keep a %i answer", async (status) => {
    const worker = loadServiceWorker(async () => response(status));
    const { event, answer } = fetchEvent(`${SITE}/missing.js`);

    worker.listeners.fetch(event);
    await expect(answer()).resolves.toMatchObject({ status });
    await flush();

    expect(worker.cache.put).not.toHaveBeenCalled();
  });

  it('answers from the stored copy when the network fails', async () => {
    const worker = loadServiceWorker(async () => {
      throw new Error('offline');
    });
    const { event, answer } = fetchEvent(`${SITE}/index.html`);

    worker.listeners.fetch(event);

    await expect(answer()).resolves.toBe('stored copy');
  });

  it("ignores requests that aren't GET", async () => {
    const worker = loadServiceWorker(async () => response(200));
    const { event } = fetchEvent(`${SITE}/anything`, 'POST');

    worker.listeners.fetch(event);

    expect(event.respondWith).not.toHaveBeenCalled();
  });
});
