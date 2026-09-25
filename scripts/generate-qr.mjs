#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';

const DEFAULT_URL = 'https://adventistgiving.org/donate/AN48CO';
const QR_WIDTH = 368;
const QR_MARGIN = 4;

const getOption = (name, fallback) => {
  const index = process.argv.lastIndexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const url = getOption('--url', DEFAULT_URL);
const outputOption = getOption('--output');
if (!outputOption) {
  throw new Error('An output path is required. Use --output with a .jpg or .jpeg filename.');
}
const output = resolve(process.cwd(), outputOption);

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

await sharp(pixels, {
  raw: {
    width: QR_WIDTH,
    height: QR_WIDTH,
    channels: 4,
  },
})
  .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
  .toFile(output);

console.log(`Generated QR code: ${output}`);
console.log(`Encoded URL: ${url}`);
