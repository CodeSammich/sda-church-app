import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';

const { hasMetadata, stripImageMetadata } = require('../scripts/strip-image-metadata.cjs');

// Photos and design-tool exports carry hidden author names, account IDs, and
// GPS locations. This repository is public, so committed images must have none.
const images = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));

describe('committed images', () => {
  it.each(images)('%s has no hidden metadata', (file) => {
    // If this fails, run: node scripts/strip-image-metadata.cjs <file>
    expect(hasMetadata(readFileSync(file))).toBe(false);
  });
});

const pngChunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const jpegSegment = (marker: number, data: Buffer) => {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([header, data]);
};

describe('stripping image metadata', () => {
  it('removes PNG text and EXIF chunks and keeps the image', () => {
    const header = pngChunk('IHDR', Buffer.alloc(13));
    const pixels = pngChunk('IDAT', Buffer.from('pixels'));
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      header,
      pngChunk('iTXt', Buffer.from('XML:com.adobe.xmp\u0000<x:xmpmeta><pdf:Author>A Person</pdf:Author>')),
      pngChunk('eXIf', Buffer.from('MM\u0000*')),
      pixels,
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    expect(hasMetadata(png)).toBe(true);

    const stripped = stripImageMetadata(png);
    expect(hasMetadata(stripped)).toBe(false);
    expect(stripped.includes(header)).toBe(true);
    expect(stripped.includes(pixels)).toBe(true);
    expect(stripped.toString('latin1')).not.toContain('A Person');
  });

  it('removes JPEG EXIF, XMP, and Photoshop segments and keeps the image data', () => {
    const colorProfile = jpegSegment(0xe2, Buffer.from('ICC_PROFILE\u0000'));
    // An EXIF thumbnail can contain its own start-of-scan marker.
    const exif = jpegSegment(0xe1, Buffer.from('Exif\u0000\u0000GPSÿÚ thumbnail'));
    const scan = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xaa, 0xbb, 0xff, 0xd9]);
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      jpegSegment(0xe0, Buffer.from('JFIF\u0000')),
      exif,
      jpegSegment(0xed, Buffer.from('Photoshop 3.0\u00008BIM')),
      colorProfile,
      scan,
    ]);
    expect(hasMetadata(jpeg)).toBe(true);

    const stripped = stripImageMetadata(jpeg);
    expect(hasMetadata(stripped)).toBe(false);
    expect(stripped.includes(colorProfile)).toBe(true);
    expect(stripped.subarray(stripped.length - scan.length).equals(scan)).toBe(true);
  });

  it('refuses other file types', () => {
    expect(() => stripImageMetadata(Buffer.from('GIF89a'))).toThrow('Only PNG and JPEG');
  });
});
