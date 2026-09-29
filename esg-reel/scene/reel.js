/* DASAN DMC — ESG reel (15.000 s, 1920x1080).
 * Every line of copy is verbatim from www.dasandmc.com/kor/esg/*.html
 * (captured 2026-09-29 by scripts/scrape.mjs). All motion is placed on the
 * beat grid / hit list exported by audio/compose.py (window.CUES). */
(() => {
  const RENDER = new URLSearchParams(location.search).has('render');
  const C = window.CUES;
  const B = C.beat;                       // 0.46875 s
  const bt = (b) => +(b * B).toFixed(6);  // beat -> seconds
  let NOW = 0;

  const DATA = {
    url: 'www.dasandmc.com/kor/esg/esg.html',
    strategy: [['1973', '설립 연도'], ['492명', '임직원'], ['8', '국내외 거점'], ['5종', '경영시스템 인증']],
    pillars: [
      { key: 'E', no: '01', en: 'ENVIRONMENT', ko: '환경경영', page: 'environment', c: '--en', t: '--en-t', bg: ['#0e5a3a', '#0a2a3a'],
        quote: '“인간·환경·사회의 조화, 환경 보호로 사회적 책임을 완수합니다”',
        stats: [['ISO 14001', '환경경영 인증'], ['B', 'CDP 기후변화 등급'], ['58', 'EcoVadis 환경'], ['10.14%', '2030 감축 목표']] },
      { key: 'S', no: '02', en: 'SOCIAL', ko: '사회책임경영', page: 'social', c: '--so', t: '--so-t', bg: ['#0f4677', '#10204a'],
        quote: '“안전하고 건강한 일터, 사람을 먼저 생각하는 책임경영”',
        stats: [['3년', '무재해 (2021~23)'], ['0', '중대재해'], ['0.46%', '평균 재해율'], ['ISO 45001', '안전보건 인증']] },
      { key: 'G', no: '03', en: 'GOVERNANCE', ko: '투명경영', page: 'governance', c: '--go', t: '--go-t', bg: ['#5e4712', '#1c1a33'],
        quote: '“정직과 신뢰로 지속가능한 성장을 추구합니다”',
        stats: [['ISO 37001', '반부패경영(ABMS)'], ['ISO 37301', '준법경영(CMS)'], ['44', 'EcoVadis 윤리'], ['2026.05', '통합 인증 취득']] },
    ],
    certs: ['ISO 14001', 'ISO 45001', 'IATF 16949', 'ISO 37001', 'ISO 37301'],
    // hub-page card boxes in CSS px (scene/assets/v/meta.json)
    cards: [[404, 618, 265, 197], [687, 618, 265, 197], [969, 618, 265, 197], [1252, 618, 265, 197], [404, 834, 265, 175]],
    pages: { esg: 1735, strategy: 3269, environment: 1706, social: 4691, governance: 3738, library: 3855 }, // jpg heights @2400w
  };

  // ------------------------------------------------------------------ utils
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const wob = (x) => Math.sin(x) * 0.55 + Math.sin(x * 2.31 + 1.7) * 0.3 + Math.sin(x * 5.07 + 0.3) * 0.15;

  function split(node) {
    const text = node.textContent;
    node.textContent = '';
    const mask = h('span', 'mask', node);
    const chars = [];
    for (const ch of text) {
      if (ch === ' ') { h('span', 'sp', mask); continue; }
      const s = h('span', 'ch', mask);
      s.textContent = ch;
      chars.push(s);
    }
    gsap.set(chars, { yPercent: 115 });
    return chars;
  }

  function browser(parent, page, url, W) {
    const bw = h('div', 'bw', parent);
    const bar = h('div', 'bar', bw, '<i></i><i></i><i></i>');
    h('div', 'url', bar).textContent = url;
    const vp = h('div', 'vp', bw);
    const pg = h('div', 'pg', vp);
    const img = h('img', '', pg);
    img.src = `assets/v/pages/${page}.jpg`;
    if (W) bw.style.width = W + 'px';
    return { bw, pg, img };
  }

  // ------------------------------------------------------------------ timeline helpers
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  const ft = (t, from, to, at) => tl.fromTo(t, from, Object.assign({ immediateRender: false }, to), at);
  const to = (t, v, at) => tl.to(t, Object.assign({ immediateRender: false }, v), at);
  const show = (sec, t0, t1) => { tl.set(sec, { autoAlpha: 1 }, t0); if (t1 != null) tl.set(sec, { autoAlpha: 0 }, t1); };
  const rise = (chars, at, o = {}) => ft(chars, { yPercent: 115 }, { yPercent: 0, duration: o.dur || 0.62, stagger: o.st ?? 0.03, ease: o.ease || 'expo.out' }, at);

  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-';
  const DG = '0123456789';
  function scramble(node, text, at, dur, set = GL) {
    node.textContent = '';
    const o = { p: 0 };
    ft(o, { p: 0 }, {
      p: 1, duration: dur, ease: 'power1.out',
      onUpdate() {
        const n = text.length, k = Math.floor(o.p * n + 1e-6), step = Math.floor(NOW * 32);
        let s = text.slice(0, k);
        for (let i = k; i < Math.min(n, k + 5); i++) s += /\s/.test(text[i]) ? text[i] : set[Math.floor(hash(i * 7.3 + step * 1.91) * set.length)];
        node.textContent = o.p >= 1 ? text : o.p <= 0 ? '' : s;
      },
    }, at);
  }
  // only real quantities count up (492명, 58, 44, 10.14%, 0.46%). Codes, years, dates and
  // grades (ISO 14001, 1973, 2026.05, B) are never animated through wrong values.
  function figure(node, text, at) {
    const m = text.match(/^(\d+(?:\.\d+)?)(.*)$/);
    const code = /^\d{4}(\.\d+)?$/.test(text);
    node.textContent = text;
    if (!code && m && (parseFloat(m[1]) >= 20 || m[1].includes('.'))) {
      const target = parseFloat(m[1]);
      const dec = (m[1].split('.')[1] || '').length;
      const o = { v: 0 };
      ft(o, { v: 0 }, { v: target, duration: 0.55, ease: 'power3.out', onUpdate() { node.textContent = o.v.toFixed(dec) + m[2]; } }, at);
    }
  }

  function statRow(parent, items, idxPrefix) {
    return items.map(([v, k], i) => {
      const s = h('div', 'stat', parent);
      h('div', 'i', s).textContent = `${idxPrefix}${String(i + 1).padStart(2, '0')}`;
      const vv = h('div', 'v', s);
      vv.textContent = v;
      h('div', 'k', s).textContent = k;
      return s;
    });
  }
  function statIn(s, at, value) {
    const v = $('.v', s), k = $('.k', s), i = $('.i', s);
    gsap.set([v, k, i], { autoAlpha: 0 });
    ft(i, { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.4 }, at - 0.03);
    ft(v, { autoAlpha: 0, y: 56, filter: 'blur(14px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.55 }, at);
    figure(v, value, at);
    ft(k, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.5 }, at + 0.07);
  }

  // ------------------------------------------------------------------ wipes between sections
  const panels = $$('#wipe i');
  gsap.set(panels, { skewX: -14, x: -3000 });
  function wipe(at, colors) {
    panels.forEach((p, i) => {
      tl.set(p, { backgroundColor: colors[i] }, at - 0.6);
      ft(p, { x: -3000 }, { x: -220, duration: 0.3, ease: 'power3.in' }, at - 0.31 + i * 0.03);
      to(p, { x: 2700, duration: 0.5, ease: 'expo.out' }, at + 0.03 + (2 - i) * 0.035);
    });
  }
  const bgTo = (c1, c2, at, dur = 0.5) => to('#bg', { '--c1': c1, '--c2': c2, duration: dur, ease: 'power2.inOut' }, at);

  // ================================================================== 0 · INTRO  (bar 0)
  function buildIntro() {
    const s = $('#intro');
    show(s, 0, bt(4));
    const hair = $('.hair', s);
    const hair2 = hair.cloneNode();
    s.appendChild(hair2);
    gsap.set([hair, hair2], { scaleX: 0 });
    ft([hair, hair2], { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'expo.out' }, 0);
    ft(hair, { y: 0 }, { y: -220, duration: 0.62, ease: 'expo.inOut' }, 0.1);
    ft(hair2, { y: 0 }, { y: 220, duration: 0.62, ease: 'expo.inOut' }, 0.1);
    ft([hair, hair2], { opacity: 1 }, { opacity: 0.35, duration: 0.6, ease: 'power2.out' }, 0.5);
    ft('#intro .strip', { top: 540, height: 0 }, { top: 320, height: 440, duration: 0.62, ease: 'expo.inOut' }, 0.1);
    ft('#intro .sky', { scale: 1.2 }, { scale: 1.04, duration: 1.875, ease: 'power2.out' }, 0);
    rise(split($('.t1', s)), 0.34, { dur: 0.7, st: 0.05 });
    rise(split($('.t2', s)), bt(1.5), { dur: 0.7, st: 0.06 });
    scramble($('.tl', s), 'DASAN DMC', 0.18, 0.5);
    scramble($('.tr', s), 'ESG', 0.3, 0.4);
    scramble($('.bl', s), DATA.url, bt(2), 0.4);
    rise(split($('.tag', s)), bt(2.25), { dur: 0.55, st: 0.012 });
    // 16th-note hats light the ticks
    const ticks = $('.ticks', s);
    const hats = C.hats;
    hats.forEach((t, i) => {
      const k = h('i', '', ticks);
      ft(k, { backgroundColor: 'rgba(255,255,255,.18)', scaleY: 1 }, { backgroundColor: '#ffffff', scaleY: 1.8, duration: 0.12, ease: 'power2.out' }, t);
      to(k, { backgroundColor: 'rgba(255,255,255,.45)', scaleY: 1, duration: 0.2, ease: 'power2.in' }, t + 0.12);
    });
    for (let i = hats.length; i < 16; i++) h('i', '', ticks);
    // collapse into the first kick
    const out = bt(4) - 0.26;
    to('#intro .strip', { top: 540, height: 0, duration: 0.26, ease: 'expo.in' }, out);
    to([hair, hair2], { y: 0, scaleX: 0, opacity: 1, duration: 0.26, ease: 'expo.in' }, out);
    to(['#intro .tag', '#intro .mono', '#intro .ticks'], { autoAlpha: 0, y: -16, duration: 0.2, ease: 'power2.in' }, out);
  }

  // ================================================================== 1 · BUILD  (bar 1) — the ESG hub page
  function buildHub() {
    const s = $('#build');
    show(s, bt(4), bt(7.5));
    const plane = $('.plane', s);
    const W = 1500, k = W / 1920;
    browser(plane, 'esg', DATA.url, null);
    const cols = ['--st', '--en', '--so', '--go', '--en'];
    const cards = DATA.cards.map(([x, y, w, hh], i) => {
      const c = h('div', 'card', plane);
      Object.assign(c.style, { left: `${x * k}px`, top: `${42 + y * k}px`, width: `${w * k}px`, height: `${hh * k}px` });
      c.style.setProperty('--c', css(cols[i]));
      h('img', '', c).src = `assets/v/cards/${i}.png`;
      h('div', 'edge', c);
      return c;
    });
    const T0 = bt(4);
    gsap.set(plane, { rotationX: 52, rotationZ: -30, z: -1100, x: 190, y: 190 });
    ft(plane, { rotationX: 52, rotationZ: -30, z: -1100, x: 190, y: 190 }, { rotationX: 36, rotationZ: -17, z: -260, x: 150, y: 110, duration: 0.8, ease: 'expo.out' }, T0);
    const FLY = bt(7.5) - 0.27;
    to(plane, { rotationX: 30, rotationZ: -12, z: -40, x: 120, y: 60, duration: FLY - T0 - 0.8, ease: 'power1.inOut' }, T0 + 0.8);
    to(plane, { z: 1700, rotationX: 8, rotationZ: -4, x: 40, y: -80, duration: 0.27, ease: 'power3.in' }, FLY);
    // 8th-note snares: the four ESG cards lift off the page one by one
    const sn = C.snares.filter((t) => t < bt(8));
    [0, 1, 2, 3].forEach((i) => {
      const t = sn[i];
      ft(cards[i], { z: 0, scale: 1 }, { z: 110, scale: 1.08, duration: 0.42, ease: 'back.out(2)' }, t);
      ft($('.edge', cards[i]), { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' }, t);
      ft(cards[i], { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }, { boxShadow: `0 30px 60px rgba(0,0,0,.35), 0 0 50px ${css(cols[i])}`, duration: 0.3 }, t);
    });
    // 16th-note roll: cards pulse in sequence, faster and faster
    sn.slice(4).forEach((t, j) => {
      const c = cards[j % 4];
      ft(c, { z: 110, scale: 1.08 }, { z: 190, scale: 1.14, duration: 0.05, ease: 'power2.out' }, t);
      to(c, { z: 110, scale: 1.08, duration: 0.1, ease: 'power2.in' }, t + 0.05);
    });
    const hd = $('.head', s);
    rise(split($('h2', hd)), T0 + 0.04, { dur: 0.6, st: 0.04 });
    ft($('.rule', hd), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, T0);
    ft($('.eyebrow', hd), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.4 }, T0);
    to(hd, { autoAlpha: 0, x: -40, duration: 0.2, ease: 'power2.in' }, bt(7.5) - 0.27);
  }

  // ================================================================== 2 · DROP (bar 2) — logo + ESG 전략 figures
  function buildLogo() {
    const s = $('#logo');
    const T = bt(8);
    show(s, T, bt(12));
    ft('#flash', { opacity: 0.9 }, { opacity: 0, duration: 0.32, ease: 'expo.out' }, T);
    const lg = $('.lg', s);
    ft(lg, { scale: 1.5, filter: 'blur(18px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, T);
    ft($('.r', lg), { x: -34, opacity: 1 }, { x: 0, opacity: 0, duration: 0.7, ease: 'expo.out' }, T);
    ft($('.c', lg), { x: 34, opacity: 1 }, { x: 0, opacity: 0, duration: 0.7, ease: 'expo.out' }, T);
    ft($('.ring', s), { width: 10, height: 10, marginLeft: -5, marginTop: -5, opacity: 0.9 },
      { width: 2800, height: 2800, marginLeft: -1400, marginTop: -1400, opacity: 0, duration: 0.9, ease: 'expo.out' }, T);
    // settle the logo up, reveal the strategy figures on 8ths
    ft($('.sweep', lg), { backgroundPosition: '-60% 0' }, { backgroundPosition: '160% 0', duration: 0.55, ease: 'power2.inOut' }, T + 0.12);
    to(lg, { y: -178, scale: 0.6, duration: 0.5, ease: 'expo.inOut' }, bt(9) - 0.08);
    const sub = $('.sub', s);
    sub.style.top = '360px';
    scramble(sub, 'ESG STRATEGY', bt(9.5), 0.45);
    const line = $('.line', s);
    line.style.top = '430px';
    ft(line, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'expo.out' }, bt(9.5));
    const row = $('.stats', s);
    row.style.top = '520px';
    const items = statRow(row, DATA.strategy, 'ESG 전략 · ');
    items.forEach((it, i) => statIn(it, bt(9.5 + i * 0.25), DATA.strategy[i][0]));
    to([lg, sub, line, row], { x: -90, duration: 0.3, ease: 'power2.in' }, bt(12) - 0.3);
    bgTo('#24338f', '#0d1640', T, 0.2);
  }

  // ================================================================== 3-5 · E / S / G (bars 3-5)
  function buildPillar(P, T) {
    const host = $('#pillars');
    const s = h('section', 'sec pillar', host);
    s.style.setProperty('--c', css(P.c));
    s.style.setProperty('--t', css(P.t));
    show(s, T, T + bt(4));
    const big = h('div', 'big', s);
    big.textContent = P.key;
    const persp = h('div', 'persp', s);
    const url = `www.dasandmc.com/kor/esg/${P.page}.html`;
    const { bw, pg } = browser(persp, P.page, url, null);
    const k = 820 / 1920;
    const hl = h('div', 'hl', pg);
    Object.assign(hl.style, { left: `${404 * k - 6}px`, top: `${449 * k - 6}px`, width: `${1112 * k + 12}px`, height: `${122 * k + 12}px` });
    const head = h('div', 'head', s);
    head.innerHTML = `<div class="eyebrow"><span>${P.no}</span><span class="rule"></span><span class="en"></span></div><h2>${P.ko}</h2>`;
    const q = h('div', 'quote', s, `<div class="bar"></div><p>${P.quote}</p>`);
    const rule = h('div', 'prule', s);
    const row = h('div', 'stats', s);
    const items = statRow(row, P.stats, `${P.key} · `);

    ft(big, { x: 260, autoAlpha: 0 }, { x: -50, autoAlpha: 1, duration: bt(4), ease: 'power3.out' }, T);
    ft(bw, { x: 320, rotationY: -40, rotationX: 12, autoAlpha: 0 }, { x: 0, rotationY: -17, rotationX: 5, autoAlpha: 1, duration: 0.75, ease: 'expo.out' }, T + 0.02);
    to(bw, { x: -26, rotationY: -12, duration: bt(4) - 0.77, ease: 'none' }, T + 0.77);
    ft(pg, { y: 0 }, { y: -120, duration: bt(4), ease: 'power1.inOut' }, T);
    ft(hl, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.35 }, T + bt(0.75));
    to(hl, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, T + bt(3));

    rise(split($('h2', head)), T + 0.03, { dur: 0.62, st: 0.045 });
    ft($('.rule', head), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, T);
    scramble($('.en', head), P.en, T + 0.05, 0.4);
    ft($('.eyebrow', head), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, T);

    gsap.set($('.bar', q), { scaleY: 0 });
    gsap.set($('p', q), { clipPath: 'inset(0% 100% 0% 0%)' });
    gsap.set([bw, big], { autoAlpha: 0 });
    ft($('.bar', q), { scaleY: 0 }, { scaleY: 1, duration: 0.35 }, T + bt(0.5));
    ft($('p', q), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power3.out' }, T + bt(0.5) + 0.05);
    ft(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.inOut' }, T + 0.25);
    items.forEach((it, i) => statIn(it, T + bt(0.5 + i * 0.5), P.stats[i][0]));

    to([head, q, rule, row, persp], { x: -110, duration: 0.3, ease: 'power2.in' }, T + bt(4) - 0.3);
    bgTo(P.bg[0], P.bg[1], T - 0.1);
  }

  // ================================================================== 6 · LIFT (bar 6) — 대외 평가·인증
  function buildRecog() {
    const s = $('#recog');
    const T = bt(24);
    show(s, T, bt(27.5));
    const floor = $('.floor', s);
    const { bw } = browser(floor, 'library', 'www.dasandmc.com/kor/esg/library.html', null);
    bw.style.height = `${42 + DATA.pages.library * 1400 / 2400}px`;
    ft(bw, { y: 0 }, { y: -1350, duration: bt(3.5), ease: 'power2.in' }, T);
    const hd = $('.head', s);
    $('.eyebrow', hd).innerHTML = '<span>04</span><span class="rule"></span>';
    rise(split($('h2', hd)), T + 0.03, { dur: 0.6, st: 0.035 });
    ft($('.rule', hd), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, T);
    ft($('.eyebrow', hd), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, T);
    gsap.set($$('.award', s), { autoAlpha: 0 });
    [[$('.a1', s), T + 0.06], [$('.a2', s), bt(25)]].forEach(([a, t]) => {
      ft(a, { autoAlpha: 0, y: 90, rotationX: -30, transformPerspective: 1200 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.65 }, t);
      ft($('.shine', a), { x: 0 }, { x: 1300, duration: 0.7, ease: 'power2.inOut' }, t + 0.12);
    });
    const chips = $('.chips', s);
    const sn = C.snares.filter((t) => t >= bt(26) && t < bt(27.5));
    DATA.certs.forEach((c, i) => {
      const e = h('div', 'chip', chips);
      e.textContent = c;
      gsap.set(e, { autoAlpha: 0 });
      ft(e, { autoAlpha: 0, y: 40, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, sn[i]);
    });
    // 32nd-note strobe on the remaining roll hits
    const all = $$('.chip', chips);
    sn.slice(DATA.certs.length).forEach((t, j) => {
      ft(all, { backgroundColor: 'rgba(255,255,255,1)', color: '#060b16' }, { backgroundColor: 'rgba(255,255,255,0.04)', color: '#ffffff', duration: 0.055, ease: 'none' }, t);
      ft('#flash', { opacity: 0.18 + j * 0.05 }, { opacity: 0, duration: 0.055, ease: 'none' }, t);
    });
    ft(s, { scale: 1 }, { scale: 1.1, duration: bt(3.5), ease: 'power3.in' }, T);
    bgTo('#24338f', '#0d1640', T - 0.1);
  }

  // ================================================================== 7 · FINALE (bar 7) — end card
  function buildEnd() {
    const s = $('#end');
    const T = bt(28);
    show(s, T);
    ft(s, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', duration: 0.6, ease: 'expo.out' }, T);
    gsap.set($('.lg', s), { autoAlpha: 0 });
    ft($('.lg', s), { scale: 1.3, autoAlpha: 0, filter: 'blur(12px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out' }, T + 0.02);
    ft($('.sweep', s), { backgroundPosition: '-60% 0' }, { backgroundPosition: '160% 0', duration: 0.7, ease: 'power2.inOut' }, bt(29) + 0.1);
    rise(split($('.tag', s)), bt(29), { dur: 0.6, st: 0.014 });
    ft($$('.esgbar i', s), { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.07, ease: 'expo.out' }, bt(29.75));
    scramble($('.url', s), DATA.url, bt(29.5), 0.4);
    scramble($('.ey', s), 'ESG', T + 0.25, 0.35);
    ft(['#end .lg', '#end .esgbar', '#end .tag', '#end .url', '#end .ey'], { y: 0 }, { y: -14, duration: DUR - T, ease: 'none' }, T);
    ft('#black', { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.in' }, DUR - 0.22);
  }

  // ================================================================== globals
  const DUR = C.duration;
  function buildGlobal() {
    // vacuum gaps: pure black
    tl.set('#black', { opacity: 1 }, bt(7.5));
    tl.set('#black', { opacity: 0 }, bt(8));
    tl.set('#black', { opacity: 1 }, bt(27.5));
    tl.set('#black', { opacity: 0 }, bt(28));
    // HUD
    ft('#hud', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, bt(4));
    tl.set('#hud', { autoAlpha: 0 }, bt(27.5));
    $('#hud .a').textContent = 'DASAN DMC — ESG';
    $('#hud .c').textContent = 'www.dasandmc.com/kor/esg';
    // section wipes on the downbeats (whoosh hits)
    wipe(bt(12), [css('--en'), '#0b3f2a', '#060b16']);
    wipe(bt(16), [css('--so'), '#0b2c4a', '#060b16']);
    wipe(bt(20), [css('--go'), '#4a3810', '#060b16']);
    wipe(bt(24), [css('--st'), '#1b2463', '#060b16']);
    bgTo('#1a2a6c', '#0c1430', 0, 0.01);
  }

  const SECTION = [[bt(4), 'ESG 메뉴'], [bt(8), 'ESG 전략'], [bt(12), '01  환경경영'], [bt(16), '02  사회책임경영'], [bt(20), '03  투명경영'], [bt(24), '04  대외 평가·인증']];
  const IMPACTS = [{ t: 0, w: 0.35 }, { t: bt(8), w: 1 }, { t: bt(28), w: 0.55 }];
  const KICKS = C.kicks;
  const CLAPS = C.claps;
  const cam = $('#cam');
  const grid = $('#grid');
  const glows = $$('#bg .glow');
  const hudB = $('#hud .b');
  const prog = $('#hud .prog i');
  const gctx = $('#grain').getContext('2d');
  const noise = [];
  function makeGrain() {
    let seed = 1015;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let f = 0; f < 6; f++) {
      const im = gctx.createImageData(960, 540);
      for (let i = 0; i < im.data.length; i += 4) { const v = rnd() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      noise.push(im);
    }
  }

  function fx(t) {
    let p = 0;
    for (const k of KICKS) { const d = t - k; if (d >= 0 && d < 0.5) p = Math.max(p, Math.exp(-d / 0.09)); }
    let c = 0;
    for (const k of CLAPS) { const d = t - k; if (d >= 0 && d < 0.3) c = Math.max(c, Math.exp(-d / 0.06)); }
    let sx = 0, sy = 0, r = 0;
    for (const im of IMPACTS) {
      const d = t - im.t;
      if (d >= 0 && d < 0.9) {
        const a = im.w * 22 * Math.exp(-d / 0.15);
        sx += a * wob(t * 41 + im.t * 3); sy += a * wob(t * 37 + 11 + im.t); r += a * 0.018 * wob(t * 29 + 5);
      }
    }
    sx += c * 2.2 * wob(t * 53); sy += c * 1.6 * wob(t * 47 + 2);
    const inGroove = t >= bt(4) && t < bt(27.5);
    const sc = 1 + (inGroove ? 0.013 : 0.004) * p;
    cam.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
    grid.style.transform = `translate3d(${(-t * 26) % 96}px, ${(-t * 14) % 96}px, 0)`;
    const go = (0.42 + 0.3 * p).toFixed(3);
    glows[0].style.opacity = go; glows[1].style.opacity = go;
    let name = '';
    for (const [st, n] of SECTION) if (t >= st) name = n;
    if (hudB.textContent !== name) hudB.textContent = name;
    prog.style.width = `${(Math.min(1, t / DUR) * 100).toFixed(2)}%`;
    const f = Math.round(t * 60);
    gctx.putImageData(noise[((f % 6) + 6) % 6], 0, 0);
  }

  function seek(t) {
    NOW = t;
    tl.seek(t, false);
    fx(t);
  }

  async function init() {
    const probes = ['200 40px Pretendard', '500 40px Pretendard', '600 40px Pretendard', '700 40px Pretendard', '800 40px Pretendard', '900 40px Pretendard', '500 20px JBM', '700 20px JBM'];
    await Promise.all(probes.map((f) => document.fonts.load(f, 'ESG 경영 환경 사회 투명 0123456789')));
    await document.fonts.ready;
    buildIntro();
    buildHub();
    buildLogo();
    DATA.pillars.forEach((P, i) => buildPillar(P, bt(12 + i * 4)));
    buildRecog();
    buildEnd();
    buildGlobal();
    makeGrain();
    await Promise.all($$('img').map((im) => (im.complete && im.naturalWidth ? im.decode().catch(() => {}) : new Promise((r) => { im.onload = () => im.decode().then(r, r); im.onerror = r; }))));
    // warm every section once so the first real frame of each is not a first paint
    for (let t = 0; t < DUR; t += 0.25) seek(t);
    seek(0);
    window.__seek = seek;
    window.__duration = DUR;
    window.__ready = true;
    if (!RENDER) preview();
  }

  function preview() {
    const btn = h('button', '', document.body);
    btn.id = 'play';
    btn.textContent = '▶ Play (with score)';
    const audio = new Audio('../out/music.wav');
    const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); document.body.style.transform = `scale(${s})`; document.body.style.transformOrigin = '0 0'; };
    fit(); addEventListener('resize', fit);
    let raf = 0;
    const loop = () => { seek(audio.currentTime); if (!audio.paused) raf = requestAnimationFrame(loop); };
    btn.onclick = () => { if (audio.paused) { if (audio.ended || audio.currentTime >= DUR - 0.01) audio.currentTime = 0; audio.play(); btn.textContent = '❚❚ Pause'; loop(); } else { audio.pause(); cancelAnimationFrame(raf); btn.textContent = '▶ Play (with score)'; } };
    audio.onended = () => { btn.textContent = '↺ Replay'; seek(DUR - 0.001); };
  }

  init();
})();
