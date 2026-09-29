// Captures the real ESG section of DASAN DMC (hub page + its ESG sub-pages):
// full-page + viewport screenshots, every image the browser actually loaded
// (taken from the network responses — the server refuses direct fetches),
// text blocks with geometry and computed styles.
// Output: scene/assets/site/<page>/{full.png, vp_XX.png, page.json, img/*}
//
//   node scripts/scrape.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scene/assets/site');
const BASE = 'https://www.dasandmc.com/kor/esg/';
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['esg', 'strategy', 'environment', 'social', 'governance', 'library'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, locale: 'ko-KR' });

for (const name of PAGES) {
  const dir = path.join(OUT, name);
  await fs.mkdir(path.join(dir, 'img'), { recursive: true });
  const page = await ctx.newPage();
  const bodies = new Map();
  page.on('response', async (r) => {
    const type = r.request().resourceType();
    if (type !== 'image' || !r.ok()) return;
    try { bodies.set(r.url(), await r.body()); } catch { /* redirected / evicted */ }
  });
  const url = BASE + name + '.html';
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  console.log(name, resp?.status());

  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 300) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(200); }
  await page.waitForTimeout(1500);
  const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
  let k = 0;
  for (let y = 0; y < H2; y += 900) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(dir, `vp_${String(k++).padStart(2, '0')}.png`) });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(dir, 'full.png'), fullPage: true });

  const data = await page.evaluate(() => {
    const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; };
    const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
    const main = document.querySelector('#container, #contents, .contents, main, .sub_con, .sub_contents') || document.body;
    const imgs = [...document.images].filter(vis).map((i) => ({ src: abs(i.currentSrc || i.src), alt: i.alt, nat: [i.naturalWidth, i.naturalHeight], box: box(i) }));
    const bgs = [];
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && vis(el)) for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) bgs.push({ src: abs(m[1]), box: box(el), cls: el.className?.toString?.() || '' });
    }
    const texts = [];
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (tw.nextNode()) {
      const el = tw.currentNode;
      if (!vis(el) || el.closest('header, #header, footer, #footer, .gnb, nav')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim();
      if (!own) continue;
      const s = getComputedStyle(el);
      texts.push({ tag: el.tagName.toLowerCase(), cls: el.className?.toString?.() || '', own, box: box(el), size: s.fontSize, weight: s.fontWeight, color: s.color });
    }
    return { url: location.href, title: document.title, scrollHeight: document.documentElement.scrollHeight, imgs, bgs, texts,
      mainText: main.innerText.replace(/\n{3,}/g, '\n\n').trim() };
  });

  data.local = {};
  for (const [u, buf] of bodies) {
    const n = decodeURIComponent(new URL(u).pathname).split('/').filter(Boolean).slice(-2).join('__').replace(/[^\w.\-가-힣]/g, '_');
    await fs.writeFile(path.join(dir, 'img', n), buf);
    data.local[u] = `img/${n}`;
  }
  await fs.writeFile(path.join(dir, 'page.json'), JSON.stringify(data, null, 1));
  console.log(`  images ${bodies.size}, texts ${data.texts.length}, height ${data.scrollHeight}`);
  await page.close();
}
await browser.close();
