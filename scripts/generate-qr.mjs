#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import QRCode from 'qrcode';
import jpeg from 'jpeg-js';

const DEFAULT_URL = 'https://adventistgiving.org/donate/AN48CO';
const DEFAULT_OUTPUT = 'build/qr/queens_adventist_giving_qr_code_368x368.jpg';
const QR_WIDTH = 368;
const QR_MARGIN = 4;

const getOption = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const url = getOption('--url', DEFAULT_URL);
const output = resolve(process.cwd(), getOption('--output', DEFAULT_OUTPUT));

let parsedUrl;
try {
  parsedUrl = new URL(url);
} catch {
  throw new Error(`Invalid QR destination URL: ${url}`);
}

if (parsedUrl.protocol !== 'https:') {
  throw new Error('QR destination URLs must use HTTPS.');
}
if (!/\.jpe?g$/i.test(output)) {
  throw new Error('QR output files must use the .jpg or .jpeg extension.');
}

await mkdir(dirname(output), { recursive: true });
const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
const scale = QR_WIDTH / (qr.modules.size + QR_MARGIN * 2);
const scaledMargin = QR_MARGIN * scale;
const pixels = Buffer.alloc(QR_WIDTH * QR_WIDTH * 4, 255);

for (let row = 0; row < QR_WIDTH; row += 1) {
  for (let column = 0; column < QR_WIDTH; column += 1) {
    if (
      row < scaledMargin ||
      column < scaledMargin ||
      row >= QR_WIDTH - scaledMargin ||
      column >= QR_WIDTH - scaledMargin
    ) {
      continue;
    }

    const sourceRow = Math.floor((row - scaledMargin) / scale);
    const sourceColumn = Math.floor((column - scaledMargin) / scale);
    if (!qr.modules.data[sourceRow * qr.modules.size + sourceColumn]) {
      continue;
    }

    const pixelOffset = (row * QR_WIDTH + column) * 4;
    pixels[pixelOffset] = 0;
    pixels[pixelOffset + 1] = 0;
    pixels[pixelOffset + 2] = 0;
  }
}

const encoded = jpeg.encode(
  { data: pixels, width: QR_WIDTH, height: QR_WIDTH },
  100,
);
await writeFile(output, encoded.data);

console.log(`Generated QR code: ${output}`);
console.log(`Encoded URL: ${url}`);
