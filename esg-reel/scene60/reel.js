/* DASAN DMC — ESG film, 60.000 s, 1920x1080 (v3: the 30 s film at half pace).
 * Every scene holds twice as long; bt() maps the 30 s beat plan onto 2 beats each.
 * No page captures: every visual is drawn here. Copy and figures are taken
 * verbatim from www.dasandmc.com/kor/esg/*.html (captured 2026-09-29); the only
 * wording change is EcoVadis "Committed 메달" -> "Committed 배지" (EcoVadis
 * issues Committed as a badge, not a medal). Motion is placed on the beat map
 * exported by audio/compose30.py (window.CUES). */
(() => {
  const RENDER = new URLSearchParams(location.search).has('render');
  const C = window.CUES;
  const B = C.beat;
  const DUR = C.duration;
  const SLOW = 2;
  const bt = (b) => +(b * B * SLOW).toFixed(6);
  let NOW = 0;

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
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const icon = (name, parent) => {
    const e = sv('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    e.innerHTML = window.ICONS[name];
    return e;
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const wob = (x) => Math.sin(x) * 0.55 + Math.sin(x * 2.31 + 1.7) * 0.3 + Math.sin(x * 5.07 + 0.3) * 0.15;
  const cam = $('#cam');
  const section = (id, cls = '') => { const s = h('section', `sec ${cls}`, cam); s.id = id; return s; };

  function split(node) {
    const html = node.innerHTML;
    const grad = node.classList.contains('grad');
    node.textContent = '';
    const mask = h('span', 'mask', node);
    const chars = [];
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const walk = (n, cls) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) {
          for (const ch of c.textContent) {
            if (ch === ' ') { h('span', 'sp', mask); continue; }
            const s = h('span', `ch ${cls || ''}`, mask);
            s.textContent = ch;
            chars.push(s);
          }
        } else walk(c, c.className || cls);
      }
    };
    walk(tmp, grad ? 'grad' : '');
    gsap.set(chars, { yPercent: 118 });
    return chars;
  }

  // ------------------------------------------------------------------ timeline helpers
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  const ft = (t, from, to, at) => tl.fromTo(t, from, Object.assign({ immediateRender: false }, to), at);
  const to = (t, v, at) => tl.to(t, Object.assign({ immediateRender: false }, v), at);
  const show = (sec, t0, t1) => { tl.set(sec, { autoAlpha: 1 }, t0); if (t1 != null) tl.set(sec, { autoAlpha: 0 }, t1); };
  const rise = (chars, at, o = {}) => ft(chars, { yPercent: 118 }, { yPercent: 0, duration: o.dur || 0.62, stagger: o.st ?? 0.03, ease: o.ease || 'expo.out' }, at);
  const hide = (els) => gsap.set(els, { autoAlpha: 0 });
  const popIn = (el, at, o = {}) => ft(el, { autoAlpha: 0, y: o.y ?? 50, scale: o.s ?? 0.92, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: o.dur || 0.55, ease: o.ease || 'expo.out' }, at);
  const draw = (el, at, dur = 0.8, ease = 'power3.inOut') => { el.setAttribute('pathLength', 1); el.style.strokeDasharray = '1'; el.style.strokeDashoffset = '1'; ft(el, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease }, at); };
  function count(node, target, dec, fmt, at, dur = 0.6) {
    const o = { v: 0 };
    node.innerHTML = fmt((0).toFixed(dec));
    ft(o, { v: 0 }, { v: target, duration: dur, ease: 'power3.out', onUpdate() { node.innerHTML = fmt(o.v.toFixed(dec)); } }, at);
  }
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-';
  function scramble(node, text, at, dur) {
    node.textContent = '';
    const o = { p: 0 };
    ft(o, { p: 0 }, {
      p: 1, duration: dur, ease: 'power1.out',
      onUpdate() {
        const n = text.length, k = Math.floor(o.p * n + 1e-6), step = Math.floor(NOW * 32);
        let s = text.slice(0, k);
        for (let i = k; i < Math.min(n, k + 5); i++) s += /\s/.test(text[i]) ? text[i] : GL[Math.floor(hash(i * 7.3 + step * 1.91) * GL.length)];
        node.textContent = o.p >= 1 ? text : o.p <= 0 ? '' : s;
      },
    }, at);
  }
  const P = { wa: 0, wr: 143, wg: 176, wb: 255, wamp: 70, dots: 0, dotsA: 1 };
  const bgTo = (c1, c2, c3, at, dur = 0.6) => to('#bg', { '--c1': c1, '--c2': c2, '--c3': c3, duration: dur, ease: 'power2.inOut' }, at);
  const waveTo = (hex, a, at, dur = 0.6) => {
    const n = parseInt(hex.slice(1), 16);
    to(P, { wr: n >> 16, wg: (n >> 8) & 255, wb: n & 255, wa: a, duration: dur, ease: 'power2.inOut' }, at);
  };

  function header(s, no, en, ko, quote) {
    const head = h('div', 'head', s);
    head.innerHTML = `<div class="eyebrow"><span>${no}</span><span class="rule"></span><span class="en"></span></div><h2>${ko}</h2>`;
    const q = h('div', 'quote', s, `<div class="bar"></div><p>${quote}</p>`);
    gsap.set($('.bar', q), { scaleY: 0 });
    gsap.set($('p', q), { clipPath: 'inset(0% 100% 0% 0%)' });
    return { head, q, en, h2: $('h2', head) };
  }
  function headerIn(x, T) {
    gsap.set($('.eyebrow', x.head), { autoAlpha: 0 });
    rise(split(x.h2), T + 0.02, { dur: 0.65, st: 0.045 });
    ft($('.rule', x.head), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, T);
    ft($('.eyebrow', x.head), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, T);
    scramble($('.en', x.head), x.en, T + 0.05, 0.4);
    ft($('.bar', x.q), { scaleY: 0 }, { scaleY: 1, duration: 0.35 }, T + bt(0.5));
    ft($('p', x.q), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'power3.out' }, T + bt(0.5) + 0.05);
  }

  // ================================================================== A · INTRO  bars 0-1
  function A() {
    const s = section('intro');
    show(s, 0, bt(8));
    const fl = h('div', 'flare', s);
    const l1 = h('div', 'l1', s, '지속가능한 모빌리티,');
    const l2 = h('div', 'l2', s, '<span class="grad">다산디엠씨</span>가 만드는 내일');
    const lb = h('div', 'lb mono', s);
    ft(fl, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 0.0, duration: 1.6, ease: 'expo.out' }, 0);
    rise(split(l1), bt(1), { dur: 0.8, st: 0.04 });
    rise(split(l2), bt(3), { dur: 0.8, st: 0.04 });
    scramble(lb, 'DASAN DMC  ·  ESG', bt(5), 0.6);
    ft(P, { wa: 0 }, { wa: 1, duration: 1.6, ease: 'power2.out' }, 0);
    // zoom-through into the build
    const out = bt(7.5);
    to([l1, l2, lb], { scale: 1.35, filter: 'blur(18px)', autoAlpha: 0, duration: bt(0.5), ease: 'power2.in', stagger: 0.03 }, out);
  }

  // ================================================================== B · ESG 전략 in numbers  bars 2-3
  function Bsec() {
    const s = section('strat');
    const T = bt(8);
    show(s, T, bt(15.5));
    s.innerHTML = `<div class="eyebrow"><span>ESG 전략</span><span class="rule"></span><span>DASAN DMC</span></div>
      <div class="slot"></div><div class="lslot"></div><div class="idx"><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i></div><div class="viz"></div>`;
    ft($('.eyebrow', s), { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.5 }, T);
    ft($('.eyebrow .rule', s), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, T);
    const nums = ['1973', '0<small>명</small>', '8', '5<small>종</small>'];
    const labs = ['설립 연도', '임직원', '국내외 거점', '경영시스템 인증'];
    const slot = $('.slot', s), lslot = $('.lslot', s), viz = $('.viz', s);
    const N = nums.map((n) => h('div', '', slot, n));
    const L = labs.map((n) => h('div', '', lslot, n));
    gsap.set([...N, ...L], { yPercent: 105 });
    const idx = $$('.idx b', s);
    // visualisations
    const ruler = h('div', 'ruler', viz);
    const track = h('div', 'track', ruler);
    for (let y = 1950; y <= 2030; y++) {
      const k = h('div', `tk${y % 10 === 0 ? ' m' : ''}`, track);
      k.style.left = `${(y - 1950) * 24}px`;
      if (y % 10 === 0) { const l = h('div', 'yr', track); l.style.left = `${(y - 1950) * 24}px`; l.textContent = y; }
    }
    h('div', 'mark', ruler);
    const dots = h('canvas', '', viz); dots.id = 'dots'; dots.width = 800; dots.height = 300;
    const net = sv('svg', { class: 'net', viewBox: '0 0 800 560', width: 800, height: 560 }, viz);
    const nodes = [[110, 300], [250, 130], [430, 220], [610, 100], [720, 300], [560, 440], [350, 470], [170, 500]];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [2, 5], [1, 6], [2, 6], [3, 5]];
    const lines = edges.map(([a, b]) => sv('line', { x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1], stroke: css('--st-t'), 'stroke-width': 2, 'stroke-opacity': 0.55 }, net));
    const halos = nodes.map(([x, y]) => sv('circle', { cx: x, cy: y, r: 30, fill: 'none', stroke: css('--st-t'), 'stroke-width': 1.5, 'stroke-opacity': 0.5 }, net));
    const cores = nodes.map(([x, y]) => sv('circle', { cx: x, cy: y, r: 11, fill: '#fff' }, net));
    const rings = h('div', 'rings', viz);
    const R = [['ISO', '14001'], ['ISO', '45001'], ['IATF', '16949'], ['ISO', '37001'], ['ISO', '37301']].map(([a, b], i) => {
      const r = h('div', 'r', rings, `${a}<br>${b}`);
      r.style.left = `${i * 150}px`;
      return r;
    });
    hide([ruler, dots, net, rings]);

    const steps = [bt(8), bt(10), bt(12), bt(14)];
    steps.forEach((t, i) => {
      if (i > 0) {
        to(N[i - 1], { yPercent: -105, duration: 0.45, ease: 'expo.inOut' }, t - 0.12);
        to(L[i - 1], { yPercent: -105, duration: 0.45, ease: 'expo.inOut' }, t - 0.1);
      }
      ft(N[i], { yPercent: 105 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, t);
      ft(L[i], { yPercent: 105 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, t + 0.05);
      ft(idx[i], { scaleX: 0 }, { scaleX: 1, duration: bt(2), ease: 'none' }, t);
    });
    count(N[1], 492, 0, (v) => `${v}<small>명</small>`, bt(10), 0.8);
    // 1973: rewind the ruler from 2026 to 1973
    popIn(ruler, T, { y: 0, s: 1 });
    ft(track, { x: 400 - 76 * 24 }, { x: 400 - 23 * 24, duration: 1.0, ease: 'expo.out' }, T);
    to(ruler, { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, bt(10) - 0.15);
    // 492: dot matrix
    ft(dots, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, bt(10));
    ft(P, { dots: 0 }, { dots: 1, duration: 0.8, ease: 'power2.out' }, bt(10));
    to(dots, { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, bt(12) - 0.15);
    // 8 sites: network draws
    ft(net, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, bt(12));
    lines.forEach((l, i) => draw(l, bt(12) + 0.05 + i * 0.035, 0.45));
    [...halos, ...cores].forEach((c) => c.style.transformOrigin = `${c.getAttribute('cx')}px ${c.getAttribute('cy')}px`);
    cores.forEach((c, i) => ft(c, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, bt(12) + i * bt(0.25) / 2));
    halos.forEach((c, i) => ft(c, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6 }, bt(12) + 0.1 + i * bt(0.25) / 2));
    to(net, { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, bt(14) - 0.15);
    // 5 management-system certificates on the snare roll
    ft(rings, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, bt(14));
    const sn = C.snares.filter((t) => t >= bt(14) - 1e-3 && t < bt(15.5));
    R.forEach((r, i) => ft(r, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(2.2)' }, sn[i] ?? bt(14 + i * 0.25)));
    sn.slice(5).forEach((t, j) => ft(R, { backgroundColor: css('--st-t'), color: '#050a18' }, { backgroundColor: 'rgba(62,78,180,.18)', color: '#ffffff', duration: 0.06, ease: 'none' }, t));
    ft(s, { scale: 1 }, { scale: 1.06, duration: bt(7.5), ease: 'power2.in' }, T);
    waveTo('#8fb0ff', 0.35, T - 0.2);
  }

  // ================================================================== C · DROP  bar 4 — logo -> E/S/G
  function Csec() {
    const s = section('drop');
    const T = bt(16);
    show(s, T, bt(20));
    s.innerHTML = `<div class="ring"></div><div class="lg"><img class="r" src="../scene/assets/v/logo-red.svg"><img class="c" src="../scene/assets/v/logo-cyan.svg">
      <img class="w" src="../scene/assets/v/logo-white.svg" alt="DASAN 디엠씨"><div class="sweep" style="--m:url(../scene/assets/v/logo-white.svg)"></div></div><div class="sub">ESG 경영</div>`;
    ft('#flash', { opacity: 0.9 }, { opacity: 0, duration: 0.35, ease: 'expo.out' }, T);
    const lg = $('.lg', s);
    ft(lg, { scale: 1.5, filter: 'blur(18px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.6 }, T);
    ft($('.r', lg), { x: -34, opacity: 1 }, { x: 0, opacity: 0, duration: 0.7 }, T);
    ft($('.c', lg), { x: 34, opacity: 1 }, { x: 0, opacity: 0, duration: 0.7 }, T);
    ft($('.sweep', lg), { backgroundPosition: '-60% 0' }, { backgroundPosition: '160% 0', duration: 0.6, ease: 'power2.inOut' }, T + 0.15);
    ft($('.ring', s), { width: 10, height: 10, marginLeft: -5, marginTop: -5, opacity: 0.9 }, { width: 2800, height: 2800, marginLeft: -1400, marginTop: -1400, opacity: 0, duration: 0.9 }, T);
    const sub = $('.sub', s);
    rise(split(sub), bt(17), { dur: 0.6, st: 0.05 });
    // lift the logo, raise the three pillars on 8ths
    to(lg, { y: -340, scale: 0.62, duration: 0.55, ease: 'expo.inOut' }, bt(18) - 0.15);
    to(sub, { y: -330, scale: 0.8, duration: 0.55, ease: 'expo.inOut' }, bt(18) - 0.15);
    const cols = [['E', '환경경영', 'ENVIRONMENT', '--en'], ['S', '사회책임경영', 'SOCIAL', '--so'], ['G', '투명경영', 'GOVERNANCE', '--go']];
    const pans = cols.map(([L, k, e, c], i) => {
      const p = h('div', 'pillar3', s, `<div class="L">${L}</div><div class="k">${k}</div><div class="e">${e}</div>`);
      p.style.left = `${120 + i * 570}px`;
      p.style.background = css(c);
      hide(p);
      ft(p, { autoAlpha: 1, y: 700 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' }, bt(18 + i * 0.5));
      return p;
    });
    // match-cut: the E pillar becomes the Environment scene
    const X = bt(19.5);
    pans[0].style.zIndex = 5;
    bgTo('#0f5a3c', '#06291b', '#03110b', X, 0.25);
    to(pans[0], { left: 0, top: 0, width: 1920, height: 1080, borderRadius: 0, backgroundColor: '#0c4430', duration: bt(0.5), ease: 'expo.inOut' }, X);
    to($$('.L, .k, .e', pans[0]), { autoAlpha: 0, duration: 0.15 }, X);
    to(pans.slice(1), { y: 800, duration: bt(0.5), ease: 'expo.in' }, X);
    to([lg, sub], { autoAlpha: 0, duration: 0.2 }, X);
    waveTo('#8fb0ff', 0.2, T);
  }

  // ================================================================== D · E  bars 5-6
  function Dsec() {
    const T = bt(20);
    const s = section('E', 'px');
    s.style.setProperty('--c', css('--en'));
    s.style.setProperty('--t', css('--en-t'));
    show(s, T, bt(28));
    const x = header(s, '01', 'ENVIRONMENT', '환경경영', '“인간·환경·사회의 조화, 환경 보호로 사회적 책임을 완수합니다”');
    headerIn(x, T);
    waveTo('#56dca0', 0.4, T);
    // bar 5 — the six core areas
    const orb = h('div', 'orbit', s);
    const svg = sv('svg', { width: 700, height: 780, viewBox: '0 0 700 780' }, orb);
    const ring = sv('circle', { cx: 350, cy: 390, r: 300, fill: 'none', stroke: css('--en-t'), 'stroke-width': 2, 'stroke-opacity': 0.55 }, svg);
    const ring2 = sv('circle', { cx: 350, cy: 390, r: 200, fill: 'none', stroke: css('--en-t'), 'stroke-width': 1, 'stroke-opacity': 0.25, 'stroke-dasharray': '2 10' }, svg);
    draw(ring, T + 0.1, 0.9);
    const ctr = h('div', 'ctr', orb, '<b>6대 핵심 영역</b><span>ENVIRONMENT</span>');
    popIn(ctr, T + bt(0.5), { y: 20 });
    ft(ring2, { opacity: 0 }, { opacity: 1, duration: 0.6 }, T + 0.3);
    const areas = [['zap', '에너지·온실가스'], ['droplets', '수자원'], ['factory', '오염물질'], ['recycle', '순환자원·폐기물'], ['flask-conical', '화학물질'], ['sprout', '생물다양성']];
    areas.forEach(([ic, lab], i) => {
      const a = (-90 + i * 60) * Math.PI / 180;
      const n = h('div', 'node', orb);
      n.style.left = `${350 + 300 * Math.cos(a)}px`;
      n.style.top = `${390 + 300 * Math.sin(a)}px`;
      const d = h('div', 'dsk', n);
      icon(ic, d);
      const l = h('div', 'lab', n, lab);
      if (Math.sin(a) < -0.9) l.style.top = '-110px';
      hide([d, l]);
      ft(d, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, T + bt(1 + i * 0.5));
      ft(l, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4 }, T + bt(1 + i * 0.5) + 0.06);
    });
    ft(orb, { rotation: -6 }, { rotation: 0, duration: bt(4), ease: 'power2.out' }, T);
    to(orb, { autoAlpha: 0, scale: 0.85, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, bt(24) - 0.3);
    // bar 6 — bento: 2030 target, ISO 14001, environmental KPIs
    const bento = h('div', 'bento', s);
    const A1 = h('div', 'tile', bento, `<div class="tl">2030 온실가스 감축 목표</div><div class="tv">0.00%</div>
      <div class="td">현대자동차·기아 협력사<br>2030 온실가스 감축계획 이행<br>2019년 기준</div>`);
    Object.assign(A1.style, { left: '0px', top: '0px', width: '840px', height: '430px' });
    const ch = sv('svg', { class: 'bars2', viewBox: '0 0 330 300', width: 330, height: 300 }, A1);
    const base = 250, H0 = 210, H1 = H0 * (1 - 0.1014);
    const b19 = sv('rect', { x: 40, y: base - H0, width: 96, height: H0, rx: 10, fill: 'rgba(255,255,255,.28)' }, ch);
    const b30 = sv('rect', { x: 200, y: base - H1, width: 96, height: H1, rx: 10, fill: css('--en-t') }, ch);
    const ref = sv('line', { x1: 40, y1: base - H0, x2: 296, y2: base - H0, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '6 6', 'stroke-opacity': 0.7 }, ch);
    sv('text', { x: 88, y: 284, fill: 'rgba(255,255,255,.7)', 'font-size': 20, 'font-family': 'JBM', 'text-anchor': 'middle' }, ch).textContent = '2019';
    sv('text', { x: 248, y: 284, fill: 'rgba(255,255,255,.7)', 'font-size': 20, 'font-family': 'JBM', 'text-anchor': 'middle' }, ch).textContent = '2030';
    const dl = sv('text', { x: 248, y: base - H0 - 14, fill: css('--en-t'), 'font-size': 22, 'font-weight': 700, 'font-family': 'JBM', 'text-anchor': 'middle' }, ch);
    dl.textContent = '−10.14%';
    [b19, b30].forEach((b) => { b.style.transformOrigin = `0px ${base}px`; });
    const B1 = h('div', 'tile', bento, '<div class="tl">환경경영시스템</div><div class="tv" style="font-size:66px">ISO 14001</div><div class="td">인증 기반<br>PDCA 순환 관리</div>');
    Object.assign(B1.style, { left: '0px', top: '460px', width: '405px', height: '300px' });
    const C1 = h('div', 'tile', bento, '<div class="tl">환경 KPI</div><div class="tv">0종</div><div class="td">E-01~E-33 관리대장<br>정량 목표 운영</div>');
    Object.assign(C1.style, { left: '435px', top: '460px', width: '405px', height: '300px' });
    hide([A1, B1, C1]);
    popIn(A1, bt(24), { y: 70 });
    count($('.tv', A1), 10.14, 2, (v) => `${v}%`, bt(24) + 0.05, 0.9);
    ft([b19, b30], { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.12, ease: 'expo.out' }, bt(24.5));
    ft([ref, dl], { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, bt(25));
    popIn(B1, bt(25), { y: 70 });
    popIn(C1, bt(26), { y: 70 });
    count($('.tv', C1), 33, 0, (v) => `${v}종`, bt(26) + 0.03, 0.6);
    return s;
  }

  // ================================================================== E · S  bars 7-8
  function Esec() {
    const T = bt(28);
    const s = section('S', 'px');
    s.style.setProperty('--c', css('--so'));
    s.style.setProperty('--t', css('--so-t'));
    show(s, T, bt(36) + 0.05);
    const x = header(s, '02', 'SOCIAL', '사회책임경영', '“안전하고 건강한 일터, 사람을 먼저 생각하는 책임경영”');
    headerIn(x, T + 0.05);
    bgTo('#0f4a86', '#071d38', '#040b18', T - 0.05, 0.3);
    waveTo('#6bb8f5', 0.35, T);
    // bar 7 — zero serious accidents
    const z = h('div', 'zero', s);
    const zs = sv('svg', { width: 760, height: 760, viewBox: '0 0 760 760', style: 'position:absolute;left:0;top:0' }, z);
    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2;
      const r0 = i % 6 === 0 ? 318 : 330, r1 = 348;
      ticks.push(sv('line', { x1: 380 + r0 * Math.cos(a), y1: 380 + r0 * Math.sin(a), x2: 380 + r1 * Math.cos(a), y2: 380 + r1 * Math.sin(a), stroke: css('--so-t'), 'stroke-width': i % 6 === 0 ? 3 : 1.5, 'stroke-opacity': i % 6 === 0 ? 0.9 : 0.45 }, zs));
    }
    zs.style.transformOrigin = '380px 380px';
    ft(ticks, { opacity: 0 }, { opacity: 1, duration: 0.05, stagger: 0.008, ease: 'none' }, T + 0.1);
    ft(zs, { rotation: -40 }, { rotation: 0, duration: bt(4), ease: 'power2.out' }, T);
    const n0 = h('div', 'n', z, '0');
    const k0 = h('div', 'k', z, '중대재해');
    const s0 = h('div', 's', z, '3년 무재해 (2021~23)');
    hide([n0, k0, s0]);
    ft(n0, { autoAlpha: 0, scale: 1.4, filter: 'blur(24px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.7 }, T + bt(1));
    popIn(k0, T + bt(1.5), { y: 30 });
    popIn(s0, T + bt(2), { y: 20 });
    to(z, { autoAlpha: 0, scale: 0.85, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, bt(32) - 0.3);
    // bar 8 — hierarchy of controls, 5 levels
    const py = h('div', 'pyr', s);
    const ttl = h('div', 'ttl', py, '위험 통제계층 5단계');
    hide(ttl);
    popIn(ttl, bt(32), { y: 20 });
    ['제거', '대체', '공학적', '행정적', 'PPE'].forEach((lab, i) => {
      const r = h('div', 'row', py, `<i>0${i + 1}</i>${lab}`);
      const w = 780 - i * 120;
      Object.assign(r.style, { width: `${w}px`, marginLeft: `${-w / 2}px`, top: `${96 + i * 112}px`, background: `color-mix(in srgb, ${css('--so-t')} ${88 - i * 15}%, #06162b)`, color: i < 2 ? '#051326' : '#fff' });
      hide(r);
      ft(r, { autoAlpha: 0, scaleX: 0.2 }, { autoAlpha: 1, scaleX: 1, duration: 0.5, ease: 'expo.out' }, bt(32 + i * 0.5));
    });
    const chips = h('div', 'chipcol', s);
    [['shield-check', 'ISO 45001 안전보건 인증'], ['hard-hat', '7대 고위험작업 안전작업허가제'], ['hand-heart', '인권헌장 11대 선언']].forEach(([ic, t], i) => {
      const c = h('div', 'cp', chips);
      icon(ic, c);
      h('span', '', c, t);
      hide(c);
      ft(c, { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.5 }, bt(34.5 + i * 0.5));
    });
    return s;
  }

  // ================================================================== F · G  bars 9-10
  function Fsec(Ssec) {
    const T = bt(36);
    const s = section('G', 'px');
    s.style.setProperty('--c', css('--go'));
    s.style.setProperty('--t', css('--go-t'));
    show(s, T - 0.25, bt(44) + 0.1);
    // Social exits, a gold line sweeps across on the whoosh
    to(Ssec, { x: -140, autoAlpha: 0, filter: 'blur(12px)', duration: 0.35, ease: 'power2.in' }, T - 0.35);
    const gl = h('div', '', s);
    Object.assign(gl.style, { position: 'absolute', left: 0, top: '539px', width: '1920px', height: '3px', background: `linear-gradient(90deg, transparent, ${css('--go-t')} 35%, #fff 50%, ${css('--go-t')} 65%, transparent)`, boxShadow: `0 0 30px ${css('--go-t')}`, transformOrigin: '0 50%' });
    ft(gl, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.3, ease: 'power3.in' }, T - 0.25);
    to(gl, { opacity: 0, scaleY: 30, duration: 0.35, ease: 'expo.out' }, T + 0.05);
    bgTo('#4a3812', '#15110a', '#07070b', T - 0.3, 0.5);
    waveTo('#ecc872', 0.3, T - 0.3);
    const x = header(s, '03', 'GOVERNANCE', '투명경영', '“정직과 신뢰로 지속가능한 성장을 추구합니다”');
    headerIn(x, T + 0.05);
    // bar 9 — ISO 37001 + ISO 37301 integrated certification
    const se = h('div', 'seals', s);
    const mk = (left, code, ko, ring) => {
      const d = h('div', 'seal', se);
      d.style.left = `${left}px`;
      d.style.top = '90px';
      const st = sv('svg', { class: 'txt', viewBox: '0 0 380 380' }, d);
      const id = `p${code.replace(/\D/g, '')}`;
      sv('path', { id, d: 'M190,190 m-160,0 a160,160 0 1,1 320,0 a160,160 0 1,1 -320,0', fill: 'none' }, st);
      const tx = sv('text', { fill: css('--go-t'), 'font-size': 17, 'font-family': 'JBM', 'font-weight': 700, 'letter-spacing': 4 }, st);
      const tp = sv('textPath', { href: `#${id}` }, tx);
      tp.textContent = ring;
      sv('circle', { cx: 190, cy: 190, r: 184, fill: 'none', stroke: css('--go-t'), 'stroke-width': 1.5, 'stroke-opacity': 0.5 }, st);
      st.style.transformOrigin = '190px 190px';
      h('div', 'face', d, `<b>${code}</b><span>${ko}</span>`);
      return [d, st];
    };
    const [s1, r1] = mk(0, 'ISO 37001', '반부패경영', 'ISO 37001 · ANTI-BRIBERY MANAGEMENT SYSTEM · ABMS · ');
    const [s2, r2] = mk(430, 'ISO 37301', '준법경영', 'ISO 37301 · COMPLIANCE MANAGEMENT SYSTEM · CMS · ');
    const plus = h('div', '', se, '+');
    Object.assign(plus.style, { position: 'absolute', left: '395px', top: '240px', width: '50px', textAlign: 'center', font: '300 64px var(--sans)', color: css('--go-t') });
    const cap = h('div', 'cap', se, '<b>통합 인증 취득</b><span>2026.05 · 영천1공장</span>');
    hide([s1, s2, plus, cap]);
    ft([s1, s2], { autoAlpha: 0, scale: 0.6, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.7, stagger: bt(0.5), ease: 'expo.out' }, T + bt(0.5));
    ft([r1, r2], { rotation: 0 }, { rotation: -70, duration: bt(4), ease: 'none' }, T);
    popIn(plus, T + bt(1.25), { y: 0, s: 0.4 });
    popIn(cap, T + bt(2), { y: 30 });
    to(se, { autoAlpha: 0, scale: 0.85, filter: 'blur(10px)', duration: 0.3, ease: 'power2.in' }, bt(40) - 0.3);
    // bar 10 — six directions of ethical management
    const hx = h('div', 'hex', s);
    const hs = sv('svg', { width: 800, height: 780, viewBox: '0 0 800 780', style: 'position:absolute;left:0;top:0' }, hx);
    const pts = [...Array(6)].map((_, i) => { const a = (-90 + i * 60) * Math.PI / 180; return [400 + 290 * Math.cos(a), 390 + 290 * Math.sin(a)]; });
    const poly = sv('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: css('--go-t'), 'stroke-width': 2, 'stroke-opacity': 0.6 }, hs);
    const spokes = pts.map(([px, py]) => sv('line', { x1: 400, y1: 390, x2: px, y2: py, stroke: css('--go-t'), 'stroke-width': 1, 'stroke-opacity': 0.3, 'stroke-dasharray': '3 8' }, hs));
    const ctr = h('div', 'ctr', hx, '<b>윤리경영</b><span>6대 지향</span>');
    hide(ctr);
    popIn(ctr, bt(40), { y: 0, s: 0.6 });
    draw(poly, bt(40) + 0.05, 0.9);
    ft(spokes, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.05 }, bt(40.25));
    ['인권존중', '공정거래', '반부패', '준법경영', '상생협력', '지속가능경영'].forEach((lab, i) => {
      const v = h('div', 'v', hx);
      v.style.left = `${pts[i][0]}px`;
      v.style.top = `${pts[i][1]}px`;
      const d = h('div', '', v, lab);
      hide(d);
      ft(d, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, bt(40.5 + i * 0.5));
    });
    // dissolve into the breakdown
    to(s, { autoAlpha: 0, filter: 'blur(14px)', scale: 1.04, duration: 0.5, ease: 'power2.in' }, bt(44) - 0.4);
    return s;
  }

  // ================================================================== G · 대외 평가·인증  bars 11-12 (breakdown)
  function Gsec() {
    const T = bt(44);
    const s = section('recog');
    show(s, T - 0.1, bt(51.5));
    bgTo('#1d2a5a', '#0a1024', '#04060d', T - 0.4, 0.8);
    waveTo('#c9d6ff', 0.6, T - 0.2, 1.0);
    s.innerHTML = '<div class="head"><div class="eyebrow"><span>04</span><span class="rule"></span></div><h2>대외 평가·인증</h2></div>';
    ft(s, { scale: 1.05 }, { scale: 1, duration: bt(8), ease: 'power2.out' }, T);
    rise(split($('h2', s)), T + 0.05, { dur: 0.8, st: 0.05 });
    ft($('.eyebrow', s), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, T);
    ft($('.rule', s), { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, T);
    // EcoVadis gauge
    const g = h('div', 'gauge', s);
    g.style.left = '240px';
    const gs = sv('svg', { viewBox: '0 0 400 400' }, g);
    sv('circle', { cx: 200, cy: 200, r: 170, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 18 }, gs);
    const arc = sv('circle', { cx: 200, cy: 200, r: 170, fill: 'none', stroke: '#b9c6ff', 'stroke-width': 18, 'stroke-linecap': 'round', transform: 'rotate(-90 200 200)' }, gs);
    arc.setAttribute('pathLength', 100);
    arc.style.strokeDasharray = '100';
    const val = h('div', 'val', g, '<b>0</b><span>/ 100</span>');
    const lb = h('div', 'lb', g, '<b>EcoVadis 종합</b><span>Committed 배지 · 2026.02</span>');
    hide([g]);
    popIn(g, T + bt(1), { y: 40 });
    ft(arc, { strokeDashoffset: 100 }, { strokeDashoffset: 47, duration: 1.4, ease: 'power2.inOut' }, T + bt(1) + 0.1);
    count($('b', val), 53, 0, (v) => v, T + bt(1) + 0.1, 1.4);
    // CDP grade scale
    const cdp = h('div', 'gauge', s);
    cdp.style.left = '1040px';
    const sc = h('div', 'scale', cdp);
    const grades = ['D-', 'D', 'C-', 'C', 'B-', 'B', 'A-', 'A'];
    grades.forEach((gr, i) => { const e = h('div', 'st', sc, gr); e.style.left = `${40 + i * 63}px`; });
    const pin = h('div', 'pin', sc);
    const tagA = h('div', 'tag', sc, '전년');
    const tagB = h('div', 'tag', sc, '2025');
    tagA.style.left = `${40 + 63}px`; tagB.style.left = `${40 + 5 * 63}px`;
    tagA.style.color = 'rgba(255,255,255,.55)'; tagB.style.color = '#b9c6ff';
    const big = h('div', '', cdp, 'B<small style="font-size:80px;margin-left:6px">등급</small>');
    Object.assign(big.style, { position: 'absolute', left: 0, right: 0, top: '250px', textAlign: 'center', fontWeight: 800, fontSize: '150px', letterSpacing: '-.05em', lineHeight: 1 });
    const lb2 = h('div', 'lb', cdp, '<b>CDP 기후변화</b><span>2025 · 전년 D 대비 대폭 개선</span>');
    hide([cdp, tagB]);
    popIn(cdp, T + bt(2), { y: 40 });
    ft(pin, { left: 40 + 63 }, { left: 40 + 5 * 63, duration: 0.9, ease: 'expo.inOut' }, T + bt(2.5));
    ft(tagB, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3 }, T + bt(2.5) + 0.7);
    ft(big, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6 }, T + bt(2.5) + 0.6);
    // bar 12 — five certificates on the rebuild
    const cs = h('div', 'certs', s);
    const certs = [['ISO 14001', '환경경영'], ['ISO 45001', '안전보건경영'], ['IATF 16949', '자동차 품질경영'], ['ISO 37001', '반부패경영'], ['ISO 37301', '준법경영']].map(([a, b]) => h('div', 'c', cs, `<b>${a}</b><span>${b}</span>`));
    hide(certs);
    const hits = [bt(48), bt(49), bt(50), bt(50.5), bt(51)];
    certs.forEach((c, i) => ft(c, { autoAlpha: 0, y: 40, scale: 0.85 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(2)' }, hits[i]));
    C.snares.filter((t) => t > bt(51) && t < bt(51.5)).forEach((t) => ft(certs, { backgroundColor: 'rgba(255,255,255,1)', color: '#050a18' }, { backgroundColor: 'rgba(255,255,255,.06)', color: '#ffffff', duration: 0.055, ease: 'none' }, t));
    to([g, cdp, $('.head', s)], { y: -30, duration: bt(4), ease: 'power1.in' }, bt(48));
    ft(s, { filter: 'brightness(1)' }, { filter: 'brightness(1.35)', duration: bt(3.5), ease: 'power2.in' }, bt(48));
  }

  // ================================================================== H · ESG 목표·핵심 KPI  bars 13-14 (final drop)
  function Hsec() {
    const T = bt(52);
    const s = section('kpi');
    show(s, T, bt(59.5));
    ft('#flash', { opacity: 0.8 }, { opacity: 0, duration: 0.3, ease: 'expo.out' }, T);
    const K = [
      ['환경', '0<small>건</small>', '환경사고·민원', css('--en'), '#fff'],
      ['환경', '0<small>건</small>', '4대 중금속 검출', '#f4f6fa', '#15233f'],
      ['안전보건', '100<small>%</small>', '위험성평가 이행률', css('--so'), '#fff'],
      ['안전보건', '0', '중대재해', '#0b1630', '#fff'],
      ['환경경영 정책', '100<small>%</small>', '환경 법규 준수', '#f4f6fa', '#15233f'],
      ['공급망', '100<small>%</small>', '협력사 ISO 14001 인증 확대 (3년 목표)', css('--go'), '#fff'],
      ['ESG 추진 체계', '75<small>개</small>', '공통·안전보건·환경 KPI 정량 목표 운영', css('--brand'), '#fff'],
      ['환경', 'Scope 1+2', '온실가스 감축', '#0c4430', '#fff'],
    ];
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    K.forEach(([tg, v, k, bg, fg], i) => {
      const c = h('div', 'card', s, `<div class="tg">[${tg}]</div><div class="vv">${v}</div><div class="kk">${k}</div>`);
      c.style.background = bg;
      c.style.color = fg;
      const hd = h('div', 'mono', c, 'ESG 목표 · 핵심 KPI');
      Object.assign(hd.style, { position: 'absolute', left: '150px', top: '84px', fontSize: '22px', fontWeight: 700, opacity: 0.75 });
      const ct = h('div', 'mono', c, `${String(i + 1).padStart(2, '0')} / 08`);
      Object.assign(ct.style, { position: 'absolute', right: '150px', top: '84px', fontSize: '22px', fontWeight: 700, opacity: 0.75 });
      if (i === 7) $('.vv', c).style.fontSize = '250px';
      hide(c);
      const t = bt(52 + i);
      const [dx, dy] = dirs[i % 4];
      tl.set(c, { autoAlpha: 1, zIndex: i + 1 }, t);
      if (i === 0) ft(c, { scale: 1.08 }, { scale: 1, duration: 0.45, ease: 'expo.out' }, t);
      else ft(c, { x: dx * 260, y: dy * 160 }, { x: 0, y: 0, duration: 0.35, ease: 'expo.out' }, t);
      ft($('.vv', c), { scale: 1.18, filter: 'blur(14px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.4 }, t);
      ft($('.kk', c), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35 }, t + 0.06);
      ft($('.tg', c), { autoAlpha: 0 }, { autoAlpha: 0.75, duration: 0.2 }, t + 0.03);
      $('.vv', c).style.transformOrigin = '0% 60%';
      if (i < 7) tl.set(c, { autoAlpha: 0 }, bt(52 + i + 1) + 0.37);
    });
  }

  // ================================================================== I · END CARD  bar 15
  function Isec() {
    const T = bt(60);
    const s = section('end');
    show(s, T);
    s.innerHTML = `<div class="paper"></div><div class="lg"><img src="../scene/assets/v/logo-blue.svg" alt="DASAN 디엠씨"><div class="sweep" style="--m:url(../scene/assets/v/logo-white.svg)"></div></div>
      <div class="esgbar"><i style="background:var(--st)"></i><i style="background:var(--en)"></i><i style="background:var(--so)"></i><i style="background:var(--go)"></i></div>
      <div class="tag">지속가능한 모빌리티, 다산디엠씨가 만드는 내일</div><div class="mono url"></div>`;
    ft(s, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', duration: 0.6 }, T);
    const lg = $('.lg', s);
    hide(lg);
    ft(lg, { scale: 1.3, autoAlpha: 0, filter: 'blur(12px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.9 }, T + 0.02);
    ft($('.sweep', s), { backgroundPosition: '-60% 0' }, { backgroundPosition: '160% 0', duration: 0.7, ease: 'power2.inOut' }, bt(61) + 0.1);
    rise(split($('.tag', s)), bt(61), { dur: 0.6, st: 0.014 });
    ft($$('.esgbar i', s), { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.07 }, bt(61.75));
    scramble($('.url', s), 'www.dasandmc.com/kor/esg/esg.html', bt(61.5), 0.4);
    ft(['#end .lg', '#end .esgbar', '#end .tag', '#end .url'], { y: 0 }, { y: -14, duration: DUR - T, ease: 'none' }, T);
    ft('#black', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.in' }, DUR - 0.25);
    waveTo('#ffffff', 0, T, 0.1);
  }

  // ================================================================== transitions & gaps
  function globals(Esec_) {
    for (const [a, z] of C.gaps) { tl.set('#black', { opacity: 1 }, a); tl.set('#black', { opacity: 0 }, z); }
    // E -> S: vertical colour wipe on the whoosh
    const W = bt(28);
    const pan = $$('#wipe i');
    const cols = [css('--so'), '#0b3160', '#040b18'];
    pan.forEach((p, i) => {
      tl.set(p, { backgroundColor: cols[i] }, W - 0.6);
      ft(p, { y: 1500 }, { y: 0, duration: 0.32, ease: 'power3.in' }, W - 0.33 + i * 0.03);
      to(p, { y: -1500, duration: 0.5, ease: 'expo.out' }, W + 0.03 + (2 - i) * 0.035);
    });
    tl.set(Esec_, { autoAlpha: 0 }, W);
  }

  // ================================================================== per-frame effects
  const IMPACTS = C.impacts;
  const KICKS = C.kicks;
  const CLAPS = C.claps;
  const wctx = $('#wave').getContext('2d');
  const gctx = $('#grain').getContext('2d');
  const noise = [];
  let dctx = null;
  function makeGrain() {
    let seed = 1015;
    const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let f = 0; f < 6; f++) {
      const im = gctx.createImageData(960, 540);
      for (let i = 0; i < im.data.length; i += 4) { const v = rnd() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      noise.push(im);
    }
  }
  function drawWave(t) {
    wctx.clearRect(0, 0, 1920, 1080);
    if (P.wa < 0.004) return;
    wctx.fillStyle = `rgb(${P.wr | 0},${P.wg | 0},${P.wb | 0})`;
    const cols = 128, rows = 40, sp = 55, f = 820, zo = (t * 70) % sp;
    for (let j = 0; j < rows; j++) {
      const Z = 140 + j * sp - zo;
      const da = Math.min(1, (rows * sp - Z) / 800) * Math.min(1, (Z - 140) / 160 + 0.2);
      if (da <= 0) continue;
      const wz = (Z + t * 70) * 0.0045;
      for (let i = 0; i < cols; i++) {
        const X = (i / (cols - 1) - 0.5) * 5200;
        const wx = X * 0.0014;
        const ph = Math.sin(wx * 2.1 + wz * 3.0 + t * 0.8);
        const Y = 250 + P.wamp * (ph * 0.6 + Math.sin(wx * 4.3 - wz * 1.9 + t * 1.2) * 0.4);
        const sx = 960 + X * f / Z, sy = 430 + Y * f / Z;
        if (sx < -4 || sx > 1924 || sy < -4 || sy > 1084) continue;
        const sz = Math.max(1.6, 1500 / Z);
        wctx.globalAlpha = Math.min(1, P.wa * da * (0.45 + 0.75 * (0.5 + 0.5 * ph)));
        wctx.fillRect(sx, sy, sz, sz);
      }
    }
    wctx.globalAlpha = 1;
  }
  function drawDots() {
    if (!dctx) { const c = $('#dots'); if (!c) return; dctx = c.getContext('2d'); }
    dctx.clearRect(0, 0, 800, 300);
    if (P.dots <= 0) return;
    const st = css('--st-t');
    for (let i = 0; i < 492; i++) {
      const col = i % 41, row = (i / 41) | 0;
      const th = hash(i * 1.37);
      const a = Math.max(0, Math.min(1, (P.dots - th * 0.8) / 0.2));
      if (a <= 0) continue;
      dctx.globalAlpha = a;
      dctx.fillStyle = i % 41 < 41 ? st : '#fff';
      dctx.beginPath();
      dctx.arc(12 + col * 19.2, 36 + row * 19.2, 6.2, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.globalAlpha = 1;
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
    sx += c * 2 * wob(t * 53); sy += c * 1.5 * wob(t * 47 + 2);
    const groove = (t >= bt(16) && t < bt(44)) || (t >= bt(52) && t < bt(59.5));
    const sc = 1 + (groove ? 0.012 : 0.005) * p;
    cam.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
    drawWave(t);
    drawDots();
    const f = Math.round(t * 60);
    gctx.putImageData(noise[((f % 6) + 6) % 6], 0, 0);
  }

  function seek(t) {
    NOW = t;
    tl.seek(t, false);
    fx(t);
  }

  async function init() {
    const probes = ['300 40px Pretendard', '500 40px Pretendard', '600 40px Pretendard', '700 40px Pretendard', '800 40px Pretendard', '900 40px Pretendard', '500 20px JBM', '700 20px JBM'];
    await Promise.all(probes.map((f) => document.fonts.load(f, 'ESG 경영 환경 사회 투명 0123456789 ABC')));
    await document.fonts.ready;
    A();
    Bsec();
    Csec();
    const Es = Dsec();
    const Ss = Esec();
    Fsec(Ss);
    Gsec();
    Hsec();
    Isec();
    globals(Es);
    makeGrain();
    await Promise.all($$('img').map((im) => (im.complete && im.naturalWidth ? im.decode().catch(() => {}) : new Promise((r) => { im.onload = () => im.decode().then(r, r); im.onerror = r; }))));
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
    const audio = new Audio('../out/music60.wav');
    const fit = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); document.body.style.transform = `scale(${k})`; document.body.style.transformOrigin = '0 0'; };
    fit(); addEventListener('resize', fit);
    let raf = 0;
    const loop = () => { seek(audio.currentTime); if (!audio.paused) raf = requestAnimationFrame(loop); };
    btn.onclick = () => { if (audio.paused) { if (audio.currentTime >= DUR - 0.01) audio.currentTime = 0; audio.play(); btn.textContent = '❚❚ Pause'; loop(); } else { audio.pause(); cancelAnimationFrame(raf); btn.textContent = '▶ Play (with score)'; } };
    audio.onended = () => { btn.textContent = '↺ Replay'; seek(DUR - 0.001); };
  }

  init();
})();
