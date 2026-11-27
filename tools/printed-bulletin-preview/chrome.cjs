// Headless Chrome over the DevTools protocol, through a pipe, with no npm
// package. GitHub's Ubuntu runners have Google Chrome; locally, any Chrome,
// Chromium, or Playwright's headless shell works (CHROME_PATH picks one).
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const found = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
    if (found) return found;
  }
  const playwright = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(playwright)) {
    const candidates = fs.readdirSync(playwright).sort().reverse().flatMap((dir) => [
      path.join(playwright, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
      path.join(playwright, dir, 'chrome-linux', 'chrome'),
    ]);
    const found = candidates.find((file) => fs.existsSync(file));
    if (found) return found;
  }
  throw new Error('No Chrome found. Install Google Chrome or Chromium, or set CHROME_PATH.');
}

/**
 * A fontconfig setup that adds `fontDir` to the system fonts, for Chinese
 * fonts not installed on this machine. Returns the environment for Chrome.
 */
function fontEnvironment(fontDir, workDir) {
  if (!fontDir) return process.env;
  const file = path.join(workDir, 'fonts.conf');
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  fs.writeFileSync(file, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>${xml(path.resolve(fontDir))}</dir>
  <cachedir>${xml(path.join(workDir, 'fontconfig-cache'))}</cachedir>
</fontconfig>
`);
  return { ...process.env, FONTCONFIG_FILE: file };
}

/** The Chinese font families fontconfig finds, or null without fc-list. */
function chineseFonts(env) {
  const result = spawnSync('fc-list', [':lang=zh', 'family'], { encoding: 'utf8', env });
  if (result.error) return null;
  return [...new Set(result.stdout.split('\n').map((l) => l.trim()).filter(Boolean))];
}

async function launchChrome({ executable = findChrome(), env = process.env, timeoutMs = 60000 } = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printed-preview-chrome-'));
  const child = spawn(executable, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--font-render-hinting=none',
    '--remote-debugging-pipe',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], env });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
  const pending = new Map();
  const listeners = new Set();
  let nextId = 1;
  let buffer = Buffer.alloc(0);
  let exited = null;

  child.stdio[4].on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let end;
    while ((end = buffer.indexOf(0)) >= 0) {
      const message = JSON.parse(buffer.subarray(0, end).toString('utf8'));
      buffer = buffer.subarray(end + 1);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, method, timer } = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      } else {
        listeners.forEach((listener) => listener(message));
      }
    }
  });
  child.on('exit', (code, signal) => {
    exited = new Error(`Chrome exited (${code ?? signal}). ${stderr.trim()}`);
    pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(exited); });
    pending.clear();
  });
  child.on('error', (error) => { exited = error; });

  function send(method, params = {}, sessionId) {
    if (exited) return Promise.reject(exited);
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out. ${stderr.trim()}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, method, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }

  function waitFor(method, sessionId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { listeners.delete(listener); reject(new Error(`No ${method} event`)); }, timeoutMs);
      const listener = (message) => {
        if (message.method === method && message.sessionId === sessionId) {
          clearTimeout(timer);
          listeners.delete(listener);
          resolve(message.params);
        }
      };
      listeners.add(listener);
    });
  }

  /** Opens `url` at `scale` device pixels per CSS pixel. */
  async function open(url, { width = 1110, height = 900, scale = 2 } = {}) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
    const loaded = waitFor('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url }, sessionId);
    await loaded;
    return {
      async evaluate(expression) {
        const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (exceptionDetails) throw new Error(`In the page: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
        return result.value;
      },
      async screenshot(clip) {
        const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true }, sessionId);
        return Buffer.from(data, 'base64');
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  async function close() {
    const gone = exited ? Promise.resolve() : new Promise((resolve) => child.once('exit', resolve));
    send('Browser.close').catch(() => undefined);
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await gone;
    clearTimeout(timer);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  return { open, close };
}

module.exports = { findChrome, fontEnvironment, chineseFonts, launchChrome };
