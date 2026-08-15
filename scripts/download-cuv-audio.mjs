#!/usr/bin/env node

/**
 * Downloads the complete Chinese Union Version audio Bible from Audio Power.
 *
 * Audio Power's owner, Phil, explicitly approved downloading, using, and
 * self-hosting these recordings for this church app:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608
 *
 * Files are renamed to stable ASCII identifiers such as CUV_B01C001.mp3.
 */

import { createHash } from 'node:crypto';
import { mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_BASE_URL = 'https://theaudiopower.com/CUV/Recordings';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Canonical Protestant order: [USFM id, simplified-Chinese source name, chapters].
const BOOKS = [
  ['GEN', '创世记', 50], ['EXO', '出埃及记', 40], ['LEV', '利未记', 27],
  ['NUM', '民数记', 36], ['DEU', '申命记', 34], ['JOS', '约书亚记', 24],
  ['JDG', '士师记', 21], ['RUT', '路得记', 4], ['1SA', '撒母耳记上', 31],
  ['2SA', '撒母耳记下', 24], ['1KI', '列王纪上', 22], ['2KI', '列王纪下', 25],
  ['1CH', '历代志上', 29], ['2CH', '历代志下', 36], ['EZR', '以斯拉记', 10],
  ['NEH', '尼希米记', 13], ['EST', '以斯帖记', 10], ['JOB', '约伯记', 42],
  ['PSA', '诗篇', 150], ['PRO', '箴言', 31], ['ECC', '传道书', 12],
  ['SNG', '雅歌', 8], ['ISA', '以赛亚书', 66], ['JER', '耶利米书', 52],
  ['LAM', '耶利米哀歌', 5], ['EZK', '以西结书', 48], ['DAN', '但以理书', 12],
  ['HOS', '何西阿书', 14], ['JOL', '约珥书', 3], ['AMO', '阿摩司书', 9],
  ['OBA', '俄巴底亚书', 1], ['JON', '约拿书', 4], ['MIC', '弥迦书', 7],
  ['NAH', '那鸿书', 3], ['HAB', '哈巴谷书', 3], ['ZEP', '西番雅书', 3],
  ['HAG', '哈该书', 2], ['ZEC', '撒迦利亚书', 14], ['MAL', '玛拉基书', 4],
  ['MAT', '马太福音', 28], ['MRK', '马可福音', 16], ['LUK', '路加福音', 24],
  ['JHN', '约翰福音', 21], ['ACT', '使徒行传', 28], ['ROM', '罗马书', 16],
  ['1CO', '哥林多前书', 16], ['2CO', '哥林多后书', 13], ['GAL', '加拉太书', 6],
  ['EPH', '以弗所书', 6], ['PHP', '腓立比书', 4], ['COL', '歌罗西书', 4],
  ['1TH', '帖撒罗尼迦前书', 5], ['2TH', '帖撒罗尼迦后书', 3],
  ['1TI', '提摩太前书', 6], ['2TI', '提摩太后书', 4], ['TIT', '提多书', 3],
  ['PHM', '腓利门书', 1], ['HEB', '希伯来书', 13], ['JAS', '雅各书', 5],
  ['1PE', '彼得前书', 5], ['2PE', '彼得后书', 3], ['1JN', '约翰一书', 5],
  ['2JN', '约翰二书', 1], ['3JN', '约翰三书', 1], ['JUD', '犹大书', 1],
  ['REV', '启示录', 22],
];

const usage = `
Download all 1,189 Audio Power CUV chapter recordings.

Usage:
  npm run download:cuv-audio
  npm run download:cuv-audio -- --output /absolute/path --concurrency 4

Options:
  --output <path>       Destination (default: downloads/cuv-audio)
  --concurrency <n>     Simultaneous downloads, 1-12 (default: 4)
  --retries <n>         Retries per failed file, 0-10 (default: 3)
  --overwrite           Download valid existing files again
  --dry-run             Print the plan without downloading
  --help                Show this help
`;

const parseIntegerOption = (value, name, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
};

const parseArgs = (args) => {
  const options = {
    concurrency: 4,
    dryRun: false,
    output: path.join(repoRoot, 'downloads', 'cuv-audio'),
    overwrite: false,
    retries: 3,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') {
      console.log(usage.trim());
      process.exit(0);
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--overwrite') {
      options.overwrite = true;
    } else if (argument === '--output') {
      const value = args[++index];
      if (!value) throw new Error('--output requires a path.');
      options.output = path.resolve(value);
    } else if (argument === '--concurrency') {
      options.concurrency = parseIntegerOption(
        args[++index],
        '--concurrency',
        1,
        12,
      );
    } else if (argument === '--retries') {
      options.retries = parseIntegerOption(args[++index], '--retries', 0, 10);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return options;
};

const buildPlan = () =>
  BOOKS.flatMap(([bookId, sourceBookName, chapterCount], bookIndex) =>
    Array.from({ length: chapterCount }, (_, chapterIndex) => {
      const bookNumber = bookIndex + 1;
      const chapter = chapterIndex + 1;
      const sourceStem =
        chapterCount === 1 ? sourceBookName : `${sourceBookName} ${chapter}`;
      return {
        bookId,
        bookNumber,
        chapter,
        file: `CUV_B${String(bookNumber).padStart(2, '0')}C${String(chapter).padStart(3, '0')}.mp3`,
        sourceUrl: `${SOURCE_BASE_URL}/${encodeURIComponent(`${sourceStem}.mp3`)}`,
      };
    }),
  );

const hasMp3Signature = (data) =>
  ((data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0));
const isMp3 = (data) => data.length > 1024 && hasMp3Signature(data);

const isValidExistingMp3 = async (filePath) => {
  let handle;
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile() || fileStats.size <= 1024) return false;
    handle = await open(filePath, 'r');
    const header = Buffer.alloc(3);
    await handle.read(header, 0, header.length, 0);
    return hasMp3Signature(header);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  } finally {
    await handle?.close();
  }
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const downloadOne = async (item, options) => {
  const targetPath = path.join(options.output, item.file);
  if (!options.overwrite && (await isValidExistingMp3(targetPath))) {
    const fileStats = await stat(targetPath);
    return { ...item, bytes: fileStats.size, status: 'existing' };
  }

  const temporaryPath = `${targetPath}.part-${process.pid}`;
  let lastError;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      const response = await fetch(item.sourceUrl, {
        headers: { 'User-Agent': 'NYCSDAChurch-CUV-Archiver/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = Buffer.from(await response.arrayBuffer());
      if (!isMp3(data)) {
        throw new Error(
          `response is not a valid MP3 (${response.headers.get('content-type') || 'unknown type'})`,
        );
      }

      await writeFile(temporaryPath, data);
      await rename(temporaryPath, targetPath);
      return {
        ...item,
        bytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
        status: 'downloaded',
      };
    } catch (error) {
      lastError = error;
      await rm(temporaryPath, { force: true });
      if (attempt < options.retries) await delay(1_000 * 2 ** attempt);
    }
  }

  throw new Error(`${item.file}: ${lastError?.message || lastError}`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const plan = buildPlan();
  if (plan.length !== 1189) {
    throw new Error(`Internal catalog error: expected 1,189 files, got ${plan.length}.`);
  }

  console.log(`Planned ${plan.length} chapter files from ${BOOKS.length} books.`);
  console.log(`Destination: ${options.output}`);
  if (options.dryRun) {
    console.log(`First: ${plan[0].file} <- ${plan[0].sourceUrl}`);
    console.log(`Last:  ${plan.at(-1).file} <- ${plan.at(-1).sourceUrl}`);
    return;
  }

  await mkdir(options.output, { recursive: true });
  const results = [];
  const failures = [];
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < plan.length) {
      const item = plan[nextIndex++];
      try {
        const result = await downloadOne(item, options);
        results.push(result);
        completed += 1;
        console.log(
          `[${completed}/${plan.length}] ${result.status.padEnd(10)} ${item.file}`,
        );
      } catch (error) {
        failures.push({ ...item, error: error.message });
        completed += 1;
        console.error(`[${completed}/${plan.length}] failed     ${error.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  results.sort((left, right) => left.file.localeCompare(right.file));
  failures.sort((left, right) => left.file.localeCompare(right.file));

  const manifest = {
    schemaVersion: 1,
    source: SOURCE_BASE_URL,
    permission:
      'https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608',
    generatedAt: new Date().toISOString(),
    expectedFiles: plan.length,
    completedFiles: results.length,
    failedFiles: failures,
    files: results,
  };
  await writeFile(
    path.join(options.output, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const downloaded = results.filter((item) => item.status === 'downloaded').length;
  const existing = results.filter((item) => item.status === 'existing').length;
  console.log(`Finished: ${downloaded} downloaded, ${existing} existing, ${failures.length} failed.`);
  console.log(`Manifest: ${path.join(options.output, 'manifest.json')}`);
  if (failures.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
