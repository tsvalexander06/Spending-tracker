// Pure-Node PNG icon generator for the spending tracker.
// Renders a rounded-square gradient tile with three bucket bars (need/want/stupid).
// Supersampled 3x for smooth edges. No external deps (zlib is built in).
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || ".";

// ---- tiny CRC32 / PNG encoder ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- color helpers ----
function hex(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function over(dst, i, col, alpha){
  const ia = 1 - alpha;
  dst[i]   = col[0]*alpha + dst[i]*ia;
  dst[i+1] = col[1]*alpha + dst[i+1]*ia;
  dst[i+2] = col[2]*alpha + dst[i+2]*ia;
  dst[i+3] = Math.max(dst[i+3], Math.round(alpha*255));
}

// draw one icon into an RGBA buffer of size S (supersampled), then downsample.
function render(size, maskable){
  const SS = 3;                 // supersample factor
  const S = size * SS;
  const buf = new Float32Array(S * S * 4); // premultiplied-ish straight rgba, a in 0..255
  // background rounded square
  const pad = maskable ? Math.round(S * 0.10) : Math.round(S * 0.045); // maskable safe zone
  const x0 = pad, y0 = pad, x1 = S - pad, y1 = S - pad;
  const bw = x1 - x0, bh = y1 - y0;
  const r = bw * 0.235;         // corner radius

  const cTop = hex("#8b7bff");  // indigo-violet
  const cBot = hex("#5b8dff");  // blue
  const cGlow = hex("#f4405a"); // red glow hint (bottom-right)

  function inRounded(px, py){
    // signed coverage of rounded rect at pixel center
    let dx = 0, dy = 0;
    if (px < x0 + r) dx = (x0 + r) - px; else if (px > x1 - r) dx = px - (x1 - r);
    if (py < y0 + r) dy = (y0 + r) - py; else if (py > y1 - r) dy = py - (y1 - r);
    if (dx === 0 && dy === 0) return 1;
    const d = Math.sqrt(dx*dx + dy*dy);
    return Math.max(0, Math.min(1, r - d + 0.5));
  }

  for (let py = 0; py < S; py++){
    for (let px = 0; px < S; px++){
      const cov = (px < x0-1 || px > x1+1 || py < y0-1 || py > y1+1) ? 0 : inRounded(px+0.5, py+0.5);
      if (cov <= 0) continue;
      const i = (py * S + px) * 4;
      // vertical gradient
      const ty = (py - y0) / bh;
      let col = mix(cTop, cBot, Math.min(1, Math.max(0, ty)));
      // red glow bottom-right
      const gx = (px - x1) / bw, gy = (py - y1) / bh;
      const gd = Math.sqrt(gx*gx + gy*gy);
      const glow = Math.max(0, 1 - gd / 0.9);
      col = mix(col, cGlow, glow * 0.55);
      over(buf, i, col, cov);
    }
  }

  // three bucket bars (need green, want amber, stupid red), rising heights
  const bars = [
    { col: hex("#26d07c"), hf: 0.44 },  // need
    { col: hex("#f7b23b"), hf: 0.64 },  // want
    { col: hex("#f4405a"), hf: 0.86 }   // stupid
  ];
  const zoneX0 = x0 + bw * 0.20, zoneX1 = x1 - bw * 0.20;
  const zoneW = zoneX1 - zoneX0;
  const gap = zoneW * 0.14;
  const barW = (zoneW - gap * 2) / 3;
  const baseY = y0 + bh * 0.78;         // bars sit on this line
  const brad = barW * 0.34;

  bars.forEach((b, k) => {
    const bx0 = zoneX0 + k * (barW + gap);
    const bx1 = bx0 + barW;
    const topY = baseY - bh * 0.52 * b.hf;
    for (let py = Math.floor(topY - 2); py < baseY + 2; py++){
      for (let px = Math.floor(bx0 - 2); px < bx1 + 2; px++){
        if (px < 0 || py < 0 || px >= S || py >= S) continue;
        // rounded-top bar coverage
        let cov;
        const insideX = px+0.5 >= bx0 && px+0.5 <= bx1;
        const insideY = py+0.5 >= topY && py+0.5 <= baseY;
        if (insideX && insideY){
          // soften only near rounded top corners
          let dx = 0, dy = 0;
          const cxL = bx0 + brad, cxR = bx1 - brad, cyT = topY + brad;
          if (px+0.5 < cxL) dx = cxL - (px+0.5); else if (px+0.5 > cxR) dx = (px+0.5) - cxR;
          if (py+0.5 < cyT) dy = cyT - (py+0.5);
          if (dx>0 && dy>0){ const d=Math.sqrt(dx*dx+dy*dy); cov=Math.max(0,Math.min(1,brad-d+0.5)); }
          else cov = 1;
        } else cov = 0;
        if (cov <= 0) continue;
        const i = (py * S + px) * 4;
        // subtle vertical shading on bar
        const bt = (py - topY) / (baseY - topY);
        const shaded = mix(b.col, [255,255,255], 0.10*(1-bt));
        over(buf, i, shaded, cov * 0.98);
      }
    }
  });

  // downsample SSxSS -> size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      let r=0,g=0,bl=0,a=0;
      for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++){
        const i = ((y*SS+sy)*S + (x*SS+sx))*4;
        r+=buf[i]; g+=buf[i+1]; bl+=buf[i+2]; a+=buf[i+3];
      }
      const n = SS*SS, o = (y*size+x)*4;
      out[o]=Math.round(r/n); out[o+1]=Math.round(g/n); out[o+2]=Math.round(bl/n); out[o+3]=Math.round(a/n);
    }
  }
  return encodePNG(size, size, out);
}

function write(name, size, maskable){
  const png = render(size, maskable);
  fs.writeFileSync(path.join(OUT, name), png);
  console.log("wrote", name, size+"x"+size, maskable?"(maskable)":"", png.length+"b");
}

write("icon-192.png", 192, false);
write("icon-512.png", 512, false);
write("icon-maskable-192.png", 192, true);
write("icon-maskable-512.png", 512, true);
write("apple-touch-icon.png", 180, false);
