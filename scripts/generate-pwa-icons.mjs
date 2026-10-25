import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const out = path.resolve("public");
fs.mkdirSync(out, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function makePng(size) {
  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  const blue = [37, 99, 235, 255], white = [255, 255, 255, 255], green = [16, 185, 129, 255];
  const margin = Math.round(size * 0.22), arm = Math.round(size * 0.18), center = Math.floor(size / 2);
  const cross = (x, y) => (Math.abs(x - center) <= arm / 2 && y >= margin && y < size - margin) ||
    (Math.abs(y - center) <= arm / 2 && x >= margin && x < size - margin);
  const radius = Math.round(size * 0.055);
  for (let y = 0; y < size; y++) {
    const base = y * (rowBytes + 1);
    raw[base] = 0;
    for (let x = 0; x < size; x++) {
      let color = blue;
      if (cross(x, y)) color = white;
      if ((x - center) ** 2 + (y - center) ** 2 <= radius ** 2) color = green;
      const i = base + 1 + x * 4;
      raw[i] = color[0]; raw[i + 1] = color[1]; raw[i + 2] = color[2]; raw[i + 3] = color[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
for (const size of [192, 512]) fs.writeFileSync(path.join(out, "icon-" + size + ".png"), makePng(size));
console.log("Generated valid 192x192 and 512x512 Clinical Companion PWA icons.");
