import fs from 'fs';
import os from 'os';
import path from 'path';

const { syncVersion } = require('../public/sync-version');

const writeJson = (filePath: string, value: unknown) =>
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

describe('sync-version', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sda-version-sync-'));
    fs.mkdirSync(path.join(projectRoot, 'public'));
    writeJson(path.join(projectRoot, 'package.json'), {
      name: 'test-app',
      version: '1.0.0',
    });
    writeJson(path.join(projectRoot, 'package-lock.json'), {
      name: 'test-app',
      version: '1.0.0',
      packages: { '': { name: 'test-app', version: '1.0.0' } },
    });
    writeJson(path.join(projectRoot, 'app.json'), {
      expo: { version: '1.0.0' },
    });
    fs.writeFileSync(
      path.join(projectRoot, 'public/sw.js'),
      "const VERSION = '1.0.0';\n",
    );
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('uses an explicit release version as the source of truth for every file', () => {
    syncVersion({
      projectRoot,
      requestedVersion: '2.3.4',
      logger: { log: jest.fn() },
    });

    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version).toBe(
      '2.3.4',
    );
    const lock = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'),
    );
    expect(lock.version).toBe('2.3.4');
    expect(lock.packages[''].version).toBe('2.3.4');
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8')).expo.version).toBe(
      '2.3.4',
    );
    expect(fs.readFileSync(path.join(projectRoot, 'public/sw.js'), 'utf8')).toContain(
      "const VERSION = '2.3.4';",
    );
  });

  it('rejects versions outside major.minor.patch format', () => {
    expect(() =>
      syncVersion({
        projectRoot,
        requestedVersion: '2.3',
        logger: { log: jest.fn() },
      }),
    ).toThrow('Version must use major.minor.patch format');
  });

  it('keeps the existing patch-increment behavior', () => {
    const version = syncVersion({
      projectRoot,
      increment: true,
      logger: { log: jest.fn() },
    });

    expect(version).toBe('1.0.1');
    expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8')).version).toBe(
      '1.0.1',
    );
  });
});
