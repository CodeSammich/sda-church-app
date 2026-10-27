/**
 * Builds the App Store product page headers, one per listing language, from the
 * iPhone store screenshots in docs/store-assets/app-store/en-US/.
 *
 * Each header is 3840 x 1646 (21:9) with no transparency, which App Store Connect
 * requires. The tagline and the phones sit in the middle, because the App Store crops
 * the edges on some devices. See docs/store-assets/README.md.
 *
 * The Chinese taglines need Noto Sans TC Bold and Noto Sans SC Bold, which the repo
 * doesn't bundle. Download NotoSansTC-Bold.otf and NotoSansSC-Bold.otf from
 * https://github.com/notofonts/noto-cjk (Sans/SubsetOTF/TC and SC) into one folder:
 *
 *   node scripts/make-app-store-headers.cjs <fonts-folder>
 *   node scripts/strip-image-metadata.cjs docs/store-assets/app-store/header/*.png
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const fontsDir = process.argv[2];
if (!fontsDir) {
  console.error('Usage: node scripts/make-app-store-headers.cjs <fonts-folder>');
  process.exit(1);
}
const shots = path.join(root, 'docs/store-assets/app-store/en-US');
const outDir = path.join(root, 'docs/store-assets/app-store/header');
const jakarta = path.join(root, 'assets/fonts/PlusJakartaSans-Bold.ttf');

const W = 3840;
const H = 1646;

// Latin taglines use the app's Plus Jakarta Sans; the second line is light blue.
const LISTINGS = [
  {
    id: 'en-US',
    lines: ['The Bible side by side', 'in two languages'],
    font: 'Plus Jakarta Sans Bold',
    fontfile: jakarta,
    size: 128,
    phones: ['04-bible-dual-dark.png', '02-bible-dual-default.png', '03-bible-cuv-zh.png'],
  },
  {
    id: 'zh-Hant',
    lines: ['雙語對照，一起讀聖經'],
    font: 'Noto Sans TC Bold',
    fontfile: path.join(fontsDir, 'NotoSansTC-Bold.otf'),
    size: 150,
    phones: ['04-bible-dual-dark.png', '03-bible-cuv-zh.png', '02-bible-dual-default.png'],
  },
  {
    id: 'zh-Hans',
    lines: ['双语对照，一起读圣经'],
    font: 'Noto Sans SC Bold',
    fontfile: path.join(fontsDir, 'NotoSansSC-Bold.otf'),
    size: 150,
    phones: ['04-bible-dual-dark.png', '03-bible-cuv-zh.png', '02-bible-dual-default.png'],
  },
  {
    // Both Spanish listings, Mexico and Spain.
    id: 'es',
    lines: ['La Biblia lado a lado', 'en dos idiomas'],
    font: 'Plus Jakarta Sans Bold',
    fontfile: jakarta,
    size: 128,
    phones: ['04-bible-dual-dark.png', '02-bible-dual-default.png', '03-bible-cuv-zh.png'],
  },
];

// Three phones: the centre one larger and higher, all running off the bottom edge.
const SHOT_RATIO = 2868 / 1320;
const BEZEL = 22;
const GAP = 56;
const PHONES = [
  { screenW: 620, top: 600 },
  { screenW: 720, top: 470 },
  { screenW: 620, top: 600 },
];
const frameWidths = PHONES.map((phone) => phone.screenW + 2 * BEZEL);
let nextX = (W - frameWidths.reduce((sum, width) => sum + width, 0) - GAP * 2) / 2;
PHONES.forEach((phone, index) => {
  phone.x = nextX;
  nextX += frameWidths[index] + GAP;
});

const escapeMarkup = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function phoneSvg(file, phone, index) {
  const screenH = Math.round(phone.screenW * SHOT_RATIO);
  const image = await sharp(path.join(shots, file)).resize(phone.screenW, screenH).png().toBuffer();
  const frameW = phone.screenW + 2 * BEZEL;
  const frameH = screenH + 2 * BEZEL;
  const radius = Math.round(phone.screenW * 0.125);
  return `
    <rect x="${phone.x}" y="${phone.top + 36}" width="${frameW}" height="${frameH}" rx="${radius + BEZEL}" fill="#000" opacity="0.45" filter="url(#shadow)"/>
    <rect x="${phone.x}" y="${phone.top}" width="${frameW}" height="${frameH}" rx="${radius + BEZEL}" fill="#0B1016" stroke="#2A3440" stroke-width="4"/>
    <clipPath id="screen${index}"><rect x="${phone.x + BEZEL}" y="${phone.top + BEZEL}" width="${phone.screenW}" height="${screenH}" rx="${radius}"/></clipPath>
    <image x="${phone.x + BEZEL}" y="${phone.top + BEZEL}" width="${phone.screenW}" height="${screenH}" clip-path="url(#screen${index})" href="data:image/png;base64,${image.toString('base64')}"/>`;
}

async function build(listing) {
  const phones = await Promise.all(
    PHONES.map((phone, index) => phoneSvg(listing.phones[index], phone, index)),
  );
  // The brand blue (#00405C), lighter at the top left, with a glow behind the phones.
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0E5A78"/>
        <stop offset="0.55" stop-color="#00405C"/>
        <stop offset="1" stop-color="#002B40"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.62" r="0.42">
        <stop offset="0" stop-color="#2C86AD" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#2C86AD" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="34"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${phones.join('\n')}
  </svg>`;

  const markup = listing.lines
    .map((line, index) => {
      const color = index === 0 ? '#FFFFFF' : '#A9DDF2';
      return `<span foreground="${color}">${escapeMarkup(line)}</span>`;
    })
    .join('\n');
  const tagline = await sharp({
    text: {
      text: markup,
      font: `${listing.font} ${listing.size}`,
      fontfile: listing.fontfile,
      rgba: true,
      dpi: 72,
      align: 'centre',
      spacing: Math.round(listing.size * 0.18),
    },
  })
    .png()
    .toBuffer();
  const { width, height } = await sharp(tagline).metadata();
  // Centred in the band above the centre phone.
  const left = Math.round((W - width) / 2);
  const top = Math.round((PHONES[1].top - height) / 2) - 6;

  const out = path.join(outDir, `${listing.id}.png`);
  await sharp(Buffer.from(background), { density: 72 })
    .composite([{ input: tagline, left, top }])
    .flatten({ background: '#00405C' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(path.relative(root, out));
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const listing of LISTINGS) await build(listing);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
