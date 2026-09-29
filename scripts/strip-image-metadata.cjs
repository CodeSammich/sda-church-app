/**
 * Removes hidden metadata from PNG and JPEG files without touching the image:
 * author names, account IDs from design tools such as Canva, camera and phone
 * models, and GPS locations. Photos and exports carry these silently, and this
 * repository is public.
 *
 * - PNG: drops tEXt, zTXt, iTXt (including XMP), eXIf, and tIME chunks.
 * - JPEG: drops APP1 (EXIF, including GPS, and XMP) and APP13 (Photoshop and
 *   IPTC) segments. The color profile and the image data stay byte-identical.
 *
 * test/image-metadata.test.ts fails when a committed image still has any.
 *
 *   node scripts/strip-image-metadata.cjs <image> [more images…]
 */
const fs = require('node:fs');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_METADATA = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
const JPEG_METADATA = new Set([0xe1, 0xed]);

// Markers that show a file still carries metadata.
const METADATA_PATTERN = /Exif\u0000\u0000|eXIf|<x:xmpmeta|pdf:Author|dc:creator|8BIM/;

const hasMetadata = (buffer) => METADATA_PATTERN.test(Buffer.from(buffer).toString('latin1'));

const stripPng = (buffer) => {
  const kept = [buffer.subarray(0, 8)];
  let position = 8;
  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position);
    const type = buffer.toString('latin1', position + 4, position + 8);
    const chunk = buffer.subarray(position, position + 12 + length);
    if (!PNG_METADATA.has(type)) kept.push(chunk);
    position += 12 + length;
  }
  return Buffer.concat(kept);
};

const stripJpeg = (buffer) => {
  const kept = [buffer.subarray(0, 2)];
  let position = 2;
  for (;;) {
    if (buffer[position] !== 0xff) throw new Error('The JPEG has an unexpected structure.');
    const marker = buffer[position + 1];
    // Start of scan: everything from here on is image data, kept as is.
    if (marker === 0xda) {
      kept.push(buffer.subarray(position));
      return Buffer.concat(kept);
    }
    const length = buffer.readUInt16BE(position + 2);
    if (!JPEG_METADATA.has(marker)) kept.push(buffer.subarray(position, position + 2 + length));
    position += 2 + length;
  }
};

const stripImageMetadata = (buffer) => {
  const data = Buffer.from(buffer);
  if (data.subarray(0, 8).equals(PNG_SIGNATURE)) return stripPng(data);
  if (data[0] === 0xff && data[1] === 0xd8) return stripJpeg(data);
  throw new Error('Only PNG and JPEG files are supported.');
};

module.exports = { hasMetadata, stripImageMetadata };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node scripts/strip-image-metadata.cjs <image> [more images…]');
    process.exit(1);
  }
  for (const file of files) {
    const before = fs.readFileSync(file);
    const after = stripImageMetadata(before);
    fs.writeFileSync(file, after);
    console.log(`${file}: ${before.length} -> ${after.length} bytes${hasMetadata(after) ? ' (metadata remains; re-export it)' : ''}`);
  }
}
