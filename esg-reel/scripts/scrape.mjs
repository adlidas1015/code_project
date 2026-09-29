// Captures the real ESG page of DASAN DMC: full-page + viewport screenshots,
// every image / background image, the logo, text blocks with geometry and
// the page's computed brand colours. Output: scene/assets/site/*
//
//   node scripts/scrape.mjs [url]
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scene/assets/site');
const URL = process.argv[2] || 'https://www.dasandmc.com/kor/esg/esg.html';

await fs.mkdir(path.join(OUT, 'img'), { recursive: true });
await fs.mkdir(path.join(OUT, 'shots'), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  locale: 'ko-KR',
  ignoreHTTPSErrors: false,
});
const page = await ctx.newPage();
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
console.log('status', resp?.status(), page.url());

// walk the page so lazy images / scroll-triggered reveals fire
const H = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 400) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(180);
}
await page.waitForTimeout(1500);

// viewport screenshots at every 900px (for "live scroll" material)
const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
let k = 0;
for (let y = 0; y < H2; y += 900) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'shots', `vp_${String(k++).padStart(2, '0')}.png`) });
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'shots', 'hero.png') });
await page.screenshot({ path: path.join(OUT, 'shots', 'full.png'), fullPage: true });

const data = await page.evaluate(() => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; };
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const imgs = [...document.images].filter(vis).map((i) => ({
    src: abs(i.currentSrc || i.src), alt: i.alt, cls: i.className, id: i.id,
    nat: [i.naturalWidth, i.naturalHeight], box: box(i),
    inHeader: !!i.closest('header, #header, .header, .gnb, nav'),
  }));
  const bgs = [];
  for (const el of document.querySelectorAll('*')) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && vis(el)) {
      for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) bgs.push({ src: abs(m[1]), box: box(el), cls: el.className?.toString?.() || '' });
    }
  }
  const svgs = [...document.querySelectorAll('svg')].filter(vis).map((s) => ({ html: s.outerHTML, box: box(s), inHeader: !!s.closest('header, #header, .header') }));
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (tw.nextNode()) {
    const el = tw.currentNode;
    if (!vis(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!own) continue;
    const s = getComputedStyle(el);
    texts.push({ tag: el.tagName.toLowerCase(), cls: el.className?.toString?.() || '', text: el.innerText.trim().slice(0, 600), own, box: box(el),
      font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor });
  }
  const colors = {};
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    for (const c of [s.color, s.backgroundColor, s.borderTopColor]) {
      if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) colors[c] = (colors[c] || 0) + 1;
    }
  }
  return {
    url: location.href, title: document.title,
    meta: [...document.querySelectorAll('meta')].map((m) => ({ n: m.name || m.getAttribute('property'), c: m.content })).filter((m) => m.n),
    favicon: [...document.querySelectorAll('link[rel*=icon]')].map((l) => abs(l.href)),
    scrollHeight: document.documentElement.scrollHeight,
    imgs, bgs, svgs, texts,
    colors: Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 40),
    nav: [...document.querySelectorAll('nav a, header a, .gnb a')].map((a) => ({ t: a.innerText.trim(), h: abs(a.getAttribute('href')) })).filter((a) => a.t),
  };
});

// download every referenced image with the page's session
const seen = new Map();
const urls = [...data.imgs.map((i) => i.src), ...data.bgs.map((b) => b.src), ...data.favicon].filter(Boolean);
for (const u of urls) {
  if (seen.has(u) || u.startsWith('data:')) continue;
  try {
    const r = await ctx.request.get(u, { headers: { Referer: URL } });
    if (!r.ok()) { console.log('skip', r.status(), u); continue; }
    const name = decodeURIComponent(new URL(u).pathname).split('/').filter(Boolean).slice(-2).join('__').replace(/[^\w.\-가-힣]/g, '_');
    await fs.writeFile(path.join(OUT, 'img', name), await r.body());
    seen.set(u, `img/${name}`);
  } catch (e) { console.log('err', u, e.message); }
}
data.local = Object.fromEntries(seen);
await fs.writeFile(path.join(OUT, 'page.json'), JSON.stringify(data, null, 1));

// element screenshots of large blocks (section-level crops)
const blocks = await page.$$('section, .section, [class*="sec"], [class*="esg"], .cont, .content > div');
let j = 0;
for (const b of blocks) {
  const bb = await b.boundingBox();
  if (!bb || bb.width < 600 || bb.height < 200 || bb.height > 4000) continue;
  await b.screenshot({ path: path.join(OUT, 'shots', `blk_${String(j++).padStart(2, '0')}.png`) }).catch(() => {});
}
console.log(`images ${seen.size}, texts ${data.texts.length}, blocks ${j}, height ${data.scrollHeight}`);
await browser.close();
