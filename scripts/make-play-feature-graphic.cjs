/**
 * Builds Google Play's feature graphic: the app icon, the church's name in English
 * and Traditional Chinese, and a line of features on the left, and two phones with
 * Google Play store screenshots on the right (the Bible in the dark theme behind,
 * the Bible in English and Chinese in front), on the brand blue (#00405C). The
 * screenshots are docs/store-assets/google-play/phone/en-US/, so run it again when
 * those change. See docs/store-assets/README.md.
 *
 * The graphic is a 1024 x 500 PNG with no transparency, as Play requires.
 *
 * The Chinese name needs Noto Sans TC Bold, which the repo doesn't bundle. Download
 * NotoSansTC-Bold.otf from https://github.com/notofonts/noto-cjk (Sans/SubsetOTF/TC):
 *
 *   node scripts/make-play-feature-graphic.cjs <fonts-folder> [output-file]
 *   node scripts/strip-image-metadata.cjs docs/store-assets/google-play/feature-graphic.png
 */
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const [fontsDir, outArg] = process.argv.slice(2);
if (!fontsDir) {
  console.error('Usage: node scripts/make-play-feature-graphic.cjs <fonts-folder> [output-file]');
  process.exit(1);
}
const shots = path.join(root, 'docs/store-assets/google-play/phone/en-US');
const out = outArg ? path.resolve(outArg) : path.join(root, 'docs/store-assets/google-play/feature-graphic.png');
const icon = path.join(root, 'public/icon-512x512.png');
const jakartaBold = path.join(root, 'assets/fonts/PlusJakartaSans-Bold.ttf');
const jakartaMedium = path.join(root, 'assets/fonts/PlusJakartaSans-Medium.ttf');
const notoTC = path.join(fontsDir, 'NotoSansTC-Bold.otf');

const W = 1024;
const H = 500;
const LEFT = 64;
const LIGHT_BLUE = '#A9DDF2';

// Back to front, both tilted the same way and running off the bottom edge.
const SHOT_RATIO = 1920 / 1080;
const BEZEL = 7;
const PHONES = [
  { file: '04-bible-dual-dark.png', screenW: 188, x: 596, y: 118 },
  { file: '02-bible-dual-default.png', screenW: 214, x: 748, y: 60 },
];
const TILT = -9;

async function phoneSvg({ file, screenW, x, y }, index) {
  const screenH = Math.round(screenW * SHOT_RATIO);
  const image = await sharp(path.join(shots, file)).resize(screenW, screenH).png().toBuffer();
  const frameW = screenW + 2 * BEZEL;
  const frameH = screenH + 2 * BEZEL;
  const radius = Math.round(screenW * 0.11);
  const centre = `${x + frameW / 2} ${y + frameH / 2}`;
  return `
    <g transform="rotate(${TILT} ${centre})">
      <rect x="${x}" y="${y + 14}" width="${frameW}" height="${frameH}" rx="${radius + BEZEL}" fill="#000" opacity="0.5" filter="url(#shadow)"/>
      <rect x="${x}" y="${y}" width="${frameW}" height="${frameH}" rx="${radius + BEZEL}" fill="#0B1016" stroke="#2A3440" stroke-width="1.5"/>
      <clipPath id="screen${index}"><rect x="${x + BEZEL}" y="${y + BEZEL}" width="${screenW}" height="${screenH}" rx="${radius}"/></clipPath>
      <image x="${x + BEZEL}" y="${y + BEZEL}" width="${screenW}" height="${screenH}" clip-path="url(#screen${index})" href="data:image/png;base64,${image.toString('base64')}"/>
    </g>`;
}

// Text rendered by Pango, with the font file given, as in make-app-store-headers.cjs.
const text = async (markup, font, fontfile, size, spacing = 0) =>
  sharp({ text: { text: markup, font: `${font} ${size}`, fontfile, rgba: true, dpi: 72, spacing } })
    .png()
    .toBuffer();

(async () => {
  const phones = await Promise.all(PHONES.map(phoneSvg));
  const iconSize = 84;
  const iconImage = await sharp(icon).resize(iconSize, iconSize).png().toBuffer();
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0E5A78"/>
        <stop offset="0.55" stop-color="#00405C"/>
        <stop offset="1" stop-color="#002B40"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.78" cy="0.55" r="0.42">
        <stop offset="0" stop-color="#2C86AD" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#2C86AD" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
      <clipPath id="icon"><rect x="${LEFT}" y="70" width="${iconSize}" height="${iconSize}" rx="20"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <rect x="${LEFT - 1}" y="69" width="${iconSize + 2}" height="${iconSize + 2}" rx="21" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="1.5"/>
    <image x="${LEFT}" y="70" width="${iconSize}" height="${iconSize}" clip-path="url(#icon)" href="data:image/png;base64,${iconImage.toString('base64')}"/>
    ${phones.join('\n')}
  </svg>`;

  const name = await text('<span foreground="#FFFFFF">New York Chinese\nSDA Church</span>', 'Plus Jakarta Sans Bold', jakartaBold, 46, 2);
  const chineseName = await text(
    `<span foreground="${LIGHT_BLUE}" letter_spacing="${Math.round(24 * 0.12 * 1024)}">紐約華人基督復臨安息日會</span>`,
    'Noto Sans TC Bold',
    notoTC,
    24,
  );
  const features = await text(
    `<span foreground="${LIGHT_BLUE}">Bilingual Bible · Audio · Weekly bulletin · Hymns</span>`,
    'Plus Jakarta Sans Medium',
    jakartaMedium,
    18,
  );
  const nameHeight = (await sharp(name).metadata()).height;
  const nameTop = 186;
  const chineseTop = nameTop + nameHeight + 20;
  const featuresTop = chineseTop + (await sharp(chineseName).metadata()).height + 30;

  await sharp(Buffer.from(background), { density: 72 })
    .composite([
      { input: name, left: LEFT, top: nameTop },
      { input: chineseName, left: LEFT, top: chineseTop },
      { input: features, left: LEFT, top: featuresTop },
    ])
    .flatten({ background: '#00405C' })
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  console.log(path.relative(root, out));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
