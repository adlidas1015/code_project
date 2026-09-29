// Deterministic frame renderer.
// Seeks the GSAP master timeline of scene/index.html to exact times, captures
// sub-frames (180° shutter) and lets ffmpeg average them into real motion blur.
// Parallel workers render contiguous chunks to lossless RGB segments which are
// concatenated, colour-converted to BT.709 and muxed with the score.
//
//   node scripts/render.mjs [--fps 60] [--sub 3] [--workers 4] [--from 0] [--to 15]
//                           [--out out/reel.mp4] [--stills 1.2,4.0]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 60);
const SUB = +arg('sub', 3);
const WORKERS = +arg('workers', 4);
const T0 = +arg('from', 0);
const T1 = +arg('to', 15);
const OUTF = path.resolve(ROOT, arg('out', 'out/reel.mp4'));
const STILLS = arg('stills', null);
const SHUTTER = 0.5; // 180°
const TMP = path.join(ROOT, 'out', '.tmp');
fs.mkdirSync(TMP, { recursive: true });

// ---------- static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-gpu-rasterization'],
});

async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/scene/index.html?render=1`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const cdp = await ctx.newCDPSession(page);
  return { page, cdp };
}

async function grab({ page, cdp }, t) {
  await page.evaluate((t) => { window.__seek(t); }, t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true });
  return Buffer.from(data, 'base64');
}

if (STILLS) {
  const w = await openPage();
  for (const s of STILLS.split(',').map(Number)) {
    const f = path.join(ROOT, 'out', `still_${s.toFixed(3)}.png`);
    fs.writeFileSync(f, await grab(w, s));
    console.log(f);
  }
  await browser.close(); server.close();
  process.exit(0);
}

const F0 = Math.round(T0 * FPS);
const F1 = Math.round(T1 * FPS);
const total = F1 - F0;
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;

async function worker(w) {
  const a = F0 + w * per;
  const b = Math.min(F1, a + per);
  if (a >= b) return null;
  const seg = path.join(TMP, `seg_${w}.mkv`);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
    '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB)`,
    '-r', String(FPS), '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const P = await openPage();
  for (let f = a; f < b; f++) {
    for (let s = 0; s < SUB; s++) {
      // sub-samples centred on the frame time, spread over the shutter interval
      const t = f / FPS + ((s + 0.5) / SUB - 0.5) * (SHUTTER / FPS);
      const png = await grab(P, Math.max(0, t));
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    done++;
    if (done % 30 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${((total - done) / (done / el)).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  return seg;
}

const segs = (await Promise.all([...Array(WORKERS).keys()].map(worker))).filter(Boolean);
await browser.close();
server.close();

const list = path.join(TMP, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
const audio = path.join(ROOT, 'out', 'music.wav');
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
const withAudio = fs.existsSync(audio);
if (withAudio) args.push('-ss', String(T0), '-t', String(T1 - T0), '-i', audio);
args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-tune', 'film', '-g', String(FPS),
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
if (withAudio) args.push('-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest');
args.push('-movflags', '+faststart', OUTF);
await new Promise((res, rej) => spawn(FFMPEG, args, { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
console.log(`wrote ${OUTF} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
