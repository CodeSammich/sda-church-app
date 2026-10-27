/**
 * Builds the App Store product page headers, one per listing language: a tagline and
 * a line of features over three iPhone store screenshots (Bible, Home, Explore) from
 * docs/store-assets/app-store/en-US/, on the church building photo tinted brand blue.
 * The photo is the one Home and Explore show (CHURCH_BUILDING_IMAGE_URL in
 * constants/ExternalLinks.ts), downloaded each run.
 *
 * Each header is a 3840 x 1646 (21:9) PNG with no transparency. App Store Connect's
 * header upload takes PNG only, though Apple's spec page also lists JPEG. The tagline
 * and the phones sit in the middle, because the App Store crops the edges on some
 * devices. See docs/store-assets/README.md.
 *
 * The Chinese taglines need Noto Sans TC Bold and Noto Sans SC Bold, which the repo
 * doesn't bundle. Download NotoSansTC-Bold.otf and NotoSansSC-Bold.otf from
 * https://github.com/notofonts/noto-cjk (Sans/SubsetOTF/TC and SC) into one folder:
 *
 *   node scripts/make-app-store-headers.cjs <fonts-folder> [output-folder]
 *   node scripts/strip-image-metadata.cjs docs/store-assets/app-store/header/*.png
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const [fontsDir, outArg] = process.argv.slice(2);
if (!fontsDir) {
  console.error('Usage: node scripts/make-app-store-headers.cjs <fonts-folder> [output-folder]');
  process.exit(1);
}
const CHURCH_PHOTO_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221703/church_building.jpg';
const shots = path.join(root, 'docs/store-assets/app-store/en-US');
const outDir = outArg ? path.resolve(outArg) : path.join(root, 'docs/store-assets/app-store/header');
const jakarta = path.join(root, 'assets/fonts/PlusJakartaSans-Bold.ttf');

const W = 3840;
const H = 1646;

// The first line is the tagline; the second, smaller and light blue, names features.
// Latin text uses the app's Plus Jakarta Sans.
const BIBLE_EN = '02-bible-dual-default.png';
const BIBLE_ZH = '03-bible-cuv-zh.png';
const LISTINGS = [
  {
    id: 'en-US',
    lines: ['Church life, all week long', 'Bible  ·  Livestream  ·  Classes  ·  Library'],
    font: 'Plus Jakarta Sans Bold',
    fontfile: jakarta,
    size: 124,
    bible: BIBLE_EN,
  },
  {
    id: 'zh-Hant',
    lines: ['教會生活，天天同行', '聖經 · 直播 · 課程 · 圖書館'],
    font: 'Noto Sans TC Bold',
    fontfile: path.join(fontsDir, 'NotoSansTC-Bold.otf'),
    size: 140,
    bible: BIBLE_ZH,
  },
  {
    id: 'zh-Hans',
    lines: ['教会生活，天天同行', '圣经 · 直播 · 课程 · 图书馆'],
    font: 'Noto Sans SC Bold',
    fontfile: path.join(fontsDir, 'NotoSansSC-Bold.otf'),
    size: 140,
    bible: BIBLE_ZH,
  },
  {
    // Both Spanish listings, Mexico and Spain.
    id: 'es',
    lines: ['Tu iglesia, toda la semana', 'Biblia  ·  Transmisión  ·  Clases  ·  Biblioteca'],
    font: 'Plus Jakarta Sans Bold',
    fontfile: jakarta,
    size: 124,
    bible: BIBLE_EN,
  },
];
// Left to right: the Bible, Home in the centre, then Explore.
const phonesFor = (listing) => [listing.bible, '01-home-default.png', '05-explore-default.png'];

// Three phones: the centre one larger and higher, all running off the bottom edge.
const SHOT_RATIO = 2868 / 1320;
const BEZEL = 22;
const GAP = 56;
const PHONES = [
  { screenW: 620, top: 640 },
  { screenW: 720, top: 520 },
  { screenW: 620, top: 640 },
];
const frameWidths = PHONES.map((phone) => phone.screenW + 2 * BEZEL);
let nextX = (W - frameWidths.reduce((sum, width) => sum + width, 0) - GAP * 2) / 2;
PHONES.forEach((phone, index) => {
  phone.x = nextX;
  nextX += frameWidths[index] + GAP;
});

const escapeMarkup = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Plus Jakarta Sans leaves a visible gap before a comma at this size, so the letter
// before each comma is pulled in.
const tightenCommas = (markup, size) =>
  markup.replace(/([^\s,]),/g, `<span letter_spacing="${Math.round(-size * 0.1 * 1024)}">$1</span>,`);

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

async function churchPhoto() {
  const response = await fetch(CHURCH_PHOTO_URL);
  if (!response.ok) throw new Error(`Church photo: HTTP ${response.status}`);
  // Softened, so the 1921-pixel photo can fill the width and stays behind the phones.
  const photo = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .blur(6)
    .jpeg({ quality: 92 })
    .toBuffer();
  return photo.toString('base64');
}

async function build(listing, photo) {
  const phones = await Promise.all(
    PHONES.map((phone, index) => phoneSvg(phonesFor(listing)[index], phone, index)),
  );
  // The church photo under the brand blue (#00405C), lighter at the top left, with a
  // glow behind the phones.
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
    <image width="${W}" height="${H}" href="data:image/jpeg;base64,${photo}"/>
    <rect width="${W}" height="${H}" fill="url(#bg)" opacity="0.86"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${phones.join('\n')}
  </svg>`;

  const markup = listing.lines
    .map((line, index) => {
      if (index === 0) {
        return `<span foreground="#FFFFFF">${tightenCommas(escapeMarkup(line), listing.size)}</span>`;
      }
      const size = Math.round(listing.size * 0.62 * 1024);
      return `<span foreground="#A9DDF2" size="${size}">${escapeMarkup(line)}</span>`;
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
      spacing: Math.round(listing.size * 0.32),
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
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  console.log(path.relative(root, out));
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const photo = await churchPhoto();
  for (const listing of LISTINGS) await build(listing, photo);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
