// Builds the tray template icon: the DeepSeek whale from src/brand.png,
// flattened to a black silhouette, with a plus badge (this distribution's
// signature). macOS "Template" images follow the menu bar appearance.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url))
const brandPath = join(sourceDirectory, 'brand.png')

// 1) Column ink profile over alpha: split the brand lockup (whale, wordmark,
//    label) into column blobs; the whale is the first blob.
const { data, info } = await sharp(brandPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const columns = new Array(info.width).fill(0)
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] > 24) columns[x] += 1
  }
}
const GAP = Math.max(2, Math.round(info.width / 100))
const blobs = []
let start = -1
let gap = 0
for (let x = 0; x < info.width; x += 1) {
  if (columns[x] > 0) {
    if (start === -1) start = x
    gap = 0
  } else if (start !== -1) {
    gap += 1
    if (gap >= GAP) {
      blobs.push([start, x - gap])
      start = -1
    }
  }
}
if (start !== -1) blobs.push([start, info.width - 1])
if (blobs.length === 0) throw new Error('brand.png has no visible ink; cannot derive the tray icon')
const [left, right] = blobs[0]

// 2) Trim to ink, then rebuild as an opaque-black silhouette (alpha only).
const cropped = await sharp(brandPath)
  .extract({ left, top: 0, width: right - left + 1, height: info.height })
  .toBuffer()
const trimmed = await sharp(cropped).trim().toBuffer()
const { data: trimData, info: trimInfo } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const black = Buffer.alloc(trimInfo.width * trimInfo.height * 4)
for (let i = 0; i < trimInfo.width * trimInfo.height; i += 1) {
  black[i * 4 + 3] = trimData[i * 4 + 3]
}
const whale = await sharp(black, { raw: { width: trimInfo.width, height: trimInfo.height, channels: 4 } }).png().toBuffer()
console.log('build-tray-icon: whale blob', left + '..' + right, '| trimmed', trimInfo.width + 'x' + trimInfo.height)

// 3) Square canvas: whale at 66% width, plus badge at the bottom-right, with
//    the badge area cleared out of the whale first.
const canvas = 512
const whaleScaled = await sharp(whale).resize({ width: Math.round(canvas * 0.66), fit: 'inside' }).png().toBuffer()
const whaleMeta = await sharp(whaleScaled).metadata()
const whaleLeft = Math.round((canvas - whaleMeta.width) / 2)
const whaleTop = Math.round((canvas - whaleMeta.height) / 2) - Math.round(canvas * 0.05)

const plusSize = Math.round(canvas * 0.26)
const stroke = Math.round(plusSize / 4.2)
const arm = plusSize * 0.34
const plusSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + plusSize + '" height="' + plusSize + '">' +
  '<path fill="black" fill-rule="evenodd" d="' +
  'M ' + (plusSize / 2 - stroke / 2) + ' ' + plusSize * 0.08 +
  ' h ' + stroke + ' v ' + arm + ' h ' + arm + ' v ' + stroke +
  ' h ' + -arm + ' v ' + arm + ' h ' + -stroke +
  ' v ' + -arm + ' h ' + -arm + ' v ' + -stroke +
  ' h ' + arm + ' Z" /></svg>'
)

const canvasBase = sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: whaleScaled, left: whaleLeft, top: whaleTop }])
  .png().toBuffer()
const canvasPng = await sharp(await canvasBase)
  .composite([{ input: plusSvg, left: canvas - plusSize - Math.round(canvas * 0.05), top: canvas - plusSize - Math.round(canvas * 0.05), blend: 'over' }])
  .png().toBuffer()

const outs = [
  [join(sourceDirectory, 'trayTemplate.png'), 54],
  [join(sourceDirectory, 'trayTemplate@2x.png'), 36]
]
mkdirSync(dirname(outs[0][0]), { recursive: true })
for (const [out, px] of outs) {
  await sharp(canvasPng).resize(px, px, { kernel: 'lanczos3' }).png().toFile(out)
  console.log('build-tray-icon: wrote', out, px + 'px')
}
