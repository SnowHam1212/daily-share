/**
 * PWA 用の PNG アイコンを生成する。
 *
 * public/favicon.svg のデザイン（クリーム地・ティールのピン・オレンジの点）を
 * 踏襲する。iOS は manifest の SVG アイコンを読まないため PNG が要る。
 *
 * 外部依存を増やしたくないので、Node 標準の zlib だけで PNG を書き出す。
 * ラスタライザは持たないため、ピンは「円 + 三角形」の合成で描く。
 * 4x のスーパーサンプリングで輪郭を滑らかにしている。
 *
 * 使い方: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// favicon.svg と同じ配色
const BG = [0xf8, 0xf7, 0xf4] // クリーム
const PIN = [0x0f, 0x93, 0x84] // ティール
const DOT = [0xf5, 0x50, 0x1f] // オレンジ

/** 出力するアイコン。maskable も兼ねるため中央 80% に収める。 */
const TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // iOS のホーム画面用。OS 側で角丸が付くので余白は同じで良い。
  { file: 'apple-touch-icon.png', size: 180 },
]

const SS = 4 // スーパーサンプリング倍率

/** 点 (x, y) がピン形状の内側かどうか。座標は 0..1 に正規化。 */
function insidePin(x, y) {
  // 頭（円）
  const hx = 0.5
  const hy = 0.42
  const hr = 0.235
  if ((x - hx) ** 2 + (y - hy) ** 2 <= hr * hr) return true

  // 尾（三角形）: 頂点は下、底辺は円の中心やや下に重ねる
  const apexY = 0.86
  const baseY = 0.5
  const baseHalf = 0.165
  if (y >= baseY && y <= apexY) {
    // 下へ行くほど幅が狭くなる
    const t = (y - baseY) / (apexY - baseY)
    const half = baseHalf * (1 - t)
    if (Math.abs(x - hx) <= half) return true
  }
  return false
}

/** 点 (x, y) がオレンジの点の内側か。 */
function insideDot(x, y) {
  return (x - 0.5) ** 2 + (y - 0.42) ** 2 <= 0.105 ** 2
}

/** RGBA のピクセル配列を作る。 */
function render(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // スーパーサンプリングして被覆率を出す
      let pinHits = 0
      let dotHits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size
          const ny = (y + (sy + 0.5) / SS) / size
          if (insideDot(nx, ny)) dotHits++
          else if (insidePin(nx, ny)) pinHits++
        }
      }
      const total = SS * SS
      const pinA = pinHits / total
      const dotA = dotHits / total

      // 背景 → ピン → 点 の順に重ねる
      let [r, g, b] = BG
      if (pinA > 0) {
        r = Math.round(r * (1 - pinA) + PIN[0] * pinA)
        g = Math.round(g * (1 - pinA) + PIN[1] * pinA)
        b = Math.round(b * (1 - pinA) + PIN[2] * pinA)
      }
      if (dotA > 0) {
        r = Math.round(r * (1 - dotA) + DOT[0] * dotA)
        g = Math.round(g * (1 - dotA) + DOT[1] * dotA)
        b = Math.round(b * (1 - dotA) + DOT[2] * dotA)
      }

      const i = (y * size + x) * 4
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = 255
    }
  }
  return px
}

// ---- 最小限の PNG エンコーダ ----

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // 各行の先頭にフィルタ種別（0 = None）を付ける
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const { file, size } of TARGETS) {
  const png = encodePng(render(size), size)
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`${file}  ${size}x${size}  ${png.length} bytes`)
}
