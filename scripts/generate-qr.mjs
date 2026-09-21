#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import QRCode from 'qrcode';

const DEFAULT_URL = 'https://adventistgiving.org/donate/AN48CO';
const DEFAULT_OUTPUT = 'build/qr/adventistgiving.png';

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

await mkdir(dirname(output), { recursive: true });
await QRCode.toFile(output, url, {
  type: 'png',
  width: 600,
  margin: 4,
  errorCorrectionLevel: 'H',
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
});

console.log(`Generated QR code: ${output}`);
console.log(`Encoded URL: ${url}`);
