/**
 * Cuts the church symbol, with its ®, out of the app icon for the launch
 * animation (components/LaunchSplash.tsx, #538). The icon is the NAD's white
 * symbol on the brand blue (#00405C), so each pixel's red channel (0 on the
 * blue, 255 on white) is how much of the symbol covers it. The cut-out is that
 * coverage as transparency on white, cropped to the symbol: the same pixels
 * as the icon's, without the blue square. Run it again if the icon changes.
 *
 *   node scripts/make-launch-symbol.cjs
 *   node scripts/strip-image-metadata.cjs assets/images/church-symbol.png
 */
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const icon = path.join(root, 'public/icon-2048x2048.png');
const out = path.join(root, 'assets/images/church-symbol.png');

// Wide enough for the symbol at its largest (300 points) on a 3× screen.
const WIDTH = 960;
// Transparent margin kept around the symbol, in icon pixels, so resizing
// doesn't clip its softened edges.
const MARGIN = 8;

/** The red channel of `file` as one-channel raw pixels. */
const coverage = async (file) =>
  sharp(file).extractChannel('red').raw().toBuffer({ resolveWithObject: true });

/** The smallest box around every pixel the symbol covers, plus MARGIN. */
const symbolBox = ({ data, info }) => {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!data[y * info.width + x]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  left = Math.max(0, left - MARGIN);
  top = Math.max(0, top - MARGIN);
  return {
    left,
    top,
    width: Math.min(info.width - 1, right + MARGIN) - left + 1,
    height: Math.min(info.height - 1, bottom + MARGIN) - top + 1,
  };
};

(async () => {
  const red = await coverage(icon);
  const box = symbolBox(red);
  // Resizing the coverage alone keeps every pixel pure white; resizing white
  // with its transparency would leave faint grey at the edges.
  const { width, height } = red.info;
  const { data: alpha, info } = await sharp(red.data, { raw: { width, height, channels: 1 } })
    .extract(box)
    .resize({ width: WIDTH })
    // Resizing outputs three channels; keep one.
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`Wrote ${path.relative(root, out)}: ${info.width} × ${info.height}, from the icon's ${box.width} × ${box.height} at (${box.left}, ${box.top}).`);
})();
