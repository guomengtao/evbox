#!/usr/bin/env node
/**
 * EvBox 图标生成器（零依赖：手写 PNG 编码 + zlib）
 *
 * 设计：圆形表盘底盘 + 工具箱（提手 / 箱盖 / 箱体 / 工具宫格）
 *   - 与项目主题色一致：#1a1a2e 底、#7ec8e3 主色、#16213e 卡片、#0f3460 深蓝
 *   - 4 倍超采样后缩放，得到抗锯齿边缘
 *
 * 输出：
 *   src/logo.png       128x128 PNG（manifest.icon 使用）
 *   src/common/logo.ico 64x64 ICO（内嵌 PNG）
 *
 * 用法：node scripts/generate-logo.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const SS = 512; // 渲染尺寸（超采样）
const PNG_SIZE = 128;
const ICO_SIZE = 64;

// ---------------------------------------------------------------- 颜色
const BG_TOP = [0x24, 0x26, 0x4e];
const BG_BOTTOM = [0x11, 0x11, 0x22];
const ACCENT = [0x7e, 0xc8, 0xe3];
const ACCENT_DEEP = [0x0f, 0x34, 0x60];
const BODY = [0x16, 0x21, 0x3e];
const RING = [0x2f, 0x2f, 0x66];

// ---------------------------------------------------------------- 画布
const canvas = new Float64Array(SS * SS * 4); // 直通 RGBA（未预乘）

function blend(x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= SS || y >= SS) return;
  const a = alpha === undefined ? 1 : alpha;
  if (a <= 0) return;
  const i = (y * SS + x) * 4;
  const da = canvas[i + 3];
  const oa = a + da * (1 - a);
  if (oa <= 0) {
    canvas[i + 3] = 0;
    return;
  }
  for (let c = 0; c < 3; c++) {
    canvas[i + c] = (rgb[c] * a + canvas[i + c] * da * (1 - a)) / oa;
  }
  canvas[i + 3] = oa;
}

/** 按像素谓词填充一个形状 */
function paint(predicate, rgb, alpha) {
  for (let y = 0; y < SS; y++) {
    for (let x = 0; x < SS; x++) {
      if (predicate(x + 0.5, y + 0.5)) blend(x, y, rgb, alpha);
    }
  }
}

/** 挖空一个形状（用于把实心圆角矩形变成拱形/环形） */
function erase(predicate) {
  for (let y = 0; y < SS; y++) {
    for (let x = 0; x < SS; x++) {
      if (predicate(x + 0.5, y + 0.5)) canvas[(y * SS + x) * 4 + 3] = 0;
    }
  }
}

const circle = (cx, cy, r) => (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;

const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};

const ring = (outer, inner) => (x, y) => outer(x, y) && !inner(x, y);
const not = (p) => (x, y) => !p(x, y);
const and = (a, b) => (x, y) => a(x, y) && b(x, y);

// ---------------------------------------------------------------- 绘制
const CX = SS / 2;
const CY = SS / 2;

// 1. 圆形底盘（竖向渐变）
const base = circle(CX, CY, 250);
for (let y = 0; y < SS; y++) {
  const t = y / (SS - 1);
  const rgb = [
    BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
    BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
    BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t,
  ];
  for (let x = 0; x < SS; x++) {
    if (base(x + 0.5, y + 0.5)) blend(x, y, rgb, 1);
  }
}

// 2. 外圈描边（表盘质感）
paint(ring(circle(CX, CY, 250), circle(CX, CY, 240)), RING, 1);

// 3. 提手：平顶握把（外框减内框，做成拱形）
paint(roundRect(198, 146, 314, 214, 26), ACCENT, 1);
erase(roundRect(220, 168, 292, 236, 18));

// 4. 箱盖
paint(roundRect(110, 206, 402, 280, 30), ACCENT, 1);

// 5. 箱体：底色 + 描边
paint(roundRect(124, 272, 388, 404, 26), BODY, 1);
paint(ring(roundRect(124, 272, 388, 404, 26), roundRect(135, 283, 377, 393, 20)), ACCENT, 1);

// 6. 箱内工具宫格（2x2）
const TILE = 42;
const GAP = 26;
const gridW = TILE * 2 + GAP;
const gridLeft = CX - gridW / 2;
const gridTop = 283;
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 2; col++) {
    const x0 = gridLeft + col * (TILE + GAP);
    const y0 = gridTop + row * (TILE + GAP);
    paint(roundRect(x0, y0, x0 + TILE, y0 + TILE, 9), ACCENT_DEEP, 1);
    paint(roundRect(x0 + 6, y0 + 6, x0 + TILE - 6, y0 + TILE - 6, 5), ACCENT, 1);
  }
}

// ---------------------------------------------------------------- 缩放
function downsample(size) {
  const f = SS / size;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = 0; sy < f; sy++) {
        for (let sx = 0; sx < f; sx++) {
          const i = ((y * f + sy) * SS + (x * f + sx)) * 4;
          const pa = canvas[i + 3];
          r += canvas[i] * pa;
          g += canvas[i + 1] * pa;
          b += canvas[i + 2] * pa;
          a += pa;
          n++;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- PNG 编码
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeICO(size, rgba) {
  const png = encodePNG(size, rgba);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

// ---------------------------------------------------------------- 输出
const pngPath = path.join(ROOT, "src/logo.png");
const icoPath = path.join(ROOT, "src/common/logo.ico");
fs.writeFileSync(pngPath, encodePNG(PNG_SIZE, downsample(PNG_SIZE)));
fs.writeFileSync(icoPath, encodeICO(ICO_SIZE, downsample(ICO_SIZE)));
console.log("logo -> " + path.relative(ROOT, pngPath));
console.log("ico  -> " + path.relative(ROOT, icoPath));
