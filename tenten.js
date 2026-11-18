/*!
 * TenTen floating character — 10 Minute School
 * Drop-in, zero-dependency. Works on any web page, HTML slide deck, or as an overlay on a <video>.
 * Same character + rules as ReelMath (apps/reelmath/engine/brand.js):
 *   gradient blob, white eyes with the bar, blink, squish, NO MOUTH EVER;
 *   never vanishes in place (it only leaves by flying off-screen, sideways);
 *   low, short arcs; idle bob; eyes glow while it "talks"; '?' = thinking, '!' = wow, happy squint + blush.
 *
 *   <script src="tenten.js"></script>            (sounds load from ./assets/sfx/ next to this file)
 *   <script src="tenten.bundle.js"></script>     (same, with every sound inlined: one file, nothing else needed)
 *
 *   const tt = TenTen.create({ size: 140 });
 *   await tt.enter();  await tt.say('হাই! আমি টেনটেন');  await tt.point('#q1');  await tt.exit();
 *
 * Every action returns a Promise and actions queue in order (call without await to chain).
 */
(function (root) {
  'use strict';
  const BODY = 'M80 14 C126 10 149 33 149 77 C150 126 126 149 81 149 C36 151 12 133 12 86 C10 40 32 15 80 14Z';
  const SFX = ['pop', 'whoosh', 'swoosh', 'blink', 'peek', 'chime', 'ding', 'success', 'tick', 'sting'];
  // Lottie animations by the 10MS design team (assets/lottie/). fit = blob width / canvas width, sfx = sound on start.
  const REACTS = {   // w = body width / canvas, cx, cy = body centre / canvas (measured on frame 0)
    blink: { w: 0.507, cx: 0.5, cy: 0.473, sfx: 'blink' }, 'blink-smile': { w: 0.507, cx: 0.5, cy: 0.473, sfx: 'chime' },
    cry: { w: 0.543, cx: 0.498, cy: 0.498, sfx: 'blink' }, 'love-eye': { w: 0.42, cx: 0.495, cy: 0.61, sfx: 'chime' },
    'looking-around': { w: 0.507, cx: 0.5, cy: 0.473, sfx: 'peek' }, loading: { w: 0.507, cx: 0.5, cy: 0.473, sfx: 'tick' },
    perfect: { w: 0.57, cx: 0.49, cy: 0.64, sfx: 'success' }, fire: { w: 0.52, cx: 0.49, cy: 0.62, sfx: 'whoosh' },
    cool: { w: 0.55, cx: 0.5, cy: 0.6, sfx: 'ding' }, heart: { w: 0.533, cx: 0.48, cy: 0.547, sfx: 'chime' },
    writing: { w: 0.527, cx: 0.48, cy: 0.467, sfx: 'tick' }, reading: { w: 0.52, cx: 0.505, cy: 0.44, sfx: 'peek' },
  };
  const loaded = {};
  const loadScript = (url) => loaded[url] || (loaded[url] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('[TenTen] could not load ' + url)); document.head.appendChild(s);
  }));
  const MOODS = ['idle', 'happy', 'think', 'wow', 'sleepy', 'talk'];
  const E = {
    linear: (t) => t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
    out: (t) => 1 - (1 - t) ** 3,
    in: (t) => t * t * t,
    back: (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const script = typeof document !== 'undefined' && document.currentScript;
  const BASE = script && script.src ? new URL('.', script.src).href : './';
  let uid = 0, cssDone = false;

  function svgMarkup(id) {
    return `<svg viewBox="0 0 160 180" width="100%" height="100%" style="overflow:visible;display:block" aria-hidden="true">
  <defs>
    <linearGradient id="ttBody${id}" x1=".25" y1="0" x2=".8" y2="1"><stop stop-color="#ff8b91"/><stop offset=".43" stop-color="#ff1226"/><stop offset="1" stop-color="#5035d5"/></linearGradient>
    <radialGradient id="ttShine${id}" cx=".2" cy=".05" r=".85"><stop stop-color="white" stop-opacity=".85"/><stop offset=".65" stop-color="white" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse class="tt-shadow" cx="80" cy="166" rx="40" ry="7" fill="#000" opacity=".18"/>
  <g class="tt-bodyg">
    <path d="${BODY}" fill="url(#ttBody${id})" stroke="#fff" stroke-width="4"/>
    <path d="${BODY}" fill="url(#ttShine${id})"/>
    <g class="tt-blush" fill="#ff9fb4" opacity=".25"><ellipse cx="33" cy="101" rx="11" ry="6"/><ellipse cx="127" cy="101" rx="11" ry="6"/></g>
    <g class="tt-face">
      <g class="tt-eyes" fill="white">
        <rect x="58" y="72" width="44" height="7" rx="1.5" fill="white" stroke="white" stroke-width="2.2"/>
        <g class="tt-open"><ellipse cx="48" cy="77" rx="13" ry="17"/><ellipse cx="112" cy="77" rx="13" ry="17"/></g>
        <g class="tt-happy" style="opacity:0"><path d="M35 79 A13 15 0 0 1 61 79 Z"/><path d="M99 79 A13 15 0 0 1 125 79 Z"/></g>
      </g>
    </g>
  </g>
</svg>`;
  }

  function injectCSS() {
    if (cssDone || typeof document === 'undefined') return;
    cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
.tt-layer{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:2147483000}
.tt-layer.tt-inside{position:absolute}
.tt-root{position:absolute;left:0;top:0;will-change:transform;transform-origin:50% 50%}
.tt-root.tt-grab{pointer-events:auto;cursor:grab}
.tt-say{position:absolute;left:0;top:0;background:#fff;color:#1d1b19;border-radius:22px;padding:.45em .85em .5em;
  font-family:'Hind Siliguri','Noto Sans Bengali','Baloo Da 2',system-ui,sans-serif;font-weight:600;line-height:1.35;
  box-shadow:0 10px 30px rgba(20,10,60,.22),0 0 0 3px #ff1226 inset;max-width:var(--tt-maxw);width:max-content;
  opacity:0;transform-origin:var(--tt-ox) 100%;white-space:pre-wrap}
.tt-say:after{content:'';position:absolute;bottom:-11px;left:var(--tt-tail);width:22px;height:22px;background:#fff;
  transform:rotate(45deg);border-radius:0 0 6px 0;box-shadow:3px 3px 0 0 #ff1226}
.tt-icon{position:absolute;left:0;top:0;width:1.6em;height:1.6em;border-radius:50%;background:#fff;display:grid;place-items:center;
  font:800 1em/1 'Baloo Da 2',system-ui,sans-serif;color:#ff1226;box-shadow:0 6px 18px rgba(20,10,60,.25);opacity:0}
.tt-ring{position:absolute;border:4px solid #ff1226;border-radius:16px;pointer-events:none;box-shadow:0 0 0 6px rgba(255,18,38,.15)}
.tt-spark{position:absolute;left:0;top:0;width:18px;height:18px;pointer-events:none}`;
    document.head.appendChild(s);
  }

  class Tenten {
    constructor(o = {}) {
      injectCSS();
      this.o = Object.assign({ size: 140, parent: document.body, sound: true, volume: 0.6, assets: BASE + 'assets/', z: null,
        draggable: false, clock: 'auto', start: 'offscreen', side: 'right', bob: 1 }, o);
      const id = ++uid, S = this.o.size;
      this.W = S; this.H = S * 1.125;
      const parent = typeof this.o.parent === 'string' ? document.querySelector(this.o.parent) : this.o.parent;
      this.layer = document.createElement('div');
      this.layer.className = 'tt-layer' + (parent === document.body ? '' : ' tt-inside');
      if (parent !== document.body && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      if (this.o.z != null) this.layer.style.zIndex = this.o.z;
      parent.appendChild(this.layer);
      this.el = document.createElement('div');
      this.el.className = 'tt-root';
      Object.assign(this.el.style, { width: S + 'px', height: this.H + 'px' });
      this.el.innerHTML = svgMarkup(id);
      this.layer.appendChild(this.el);
      const q = (s) => this.el.querySelector(s);
      this.n = { open: q('.tt-open'), happy: q('.tt-happy'), face: q('.tt-face'), blush: q('.tt-blush'), eyes: q('.tt-eyes'), body: q('.tt-bodyg'), svg: q('svg') };
      this.lotEl = document.createElement('div');
      Object.assign(this.lotEl.style, { position: 'absolute', pointerEvents: 'none', opacity: 0 });
      this.el.appendChild(this.lotEl); this.lot = null; this.lotK = 0;
      this.sayEl = document.createElement('div'); this.sayEl.className = 'tt-say';
      this.sayEl.style.fontSize = Math.max(15, S * 0.15) + 'px';
      this.sayEl.style.setProperty('--tt-maxw', S * 2.6 + 'px');
      this.iconEl = document.createElement('div'); this.iconEl.className = 'tt-icon';
      this.iconEl.style.fontSize = Math.max(16, S * 0.22) + 'px';
      this.layer.append(this.sayEl, this.iconEl);

      this.t = 0; this.tw = []; this.timers = []; this.sparks = []; this.gen = 0;
      this.mood = 'idle'; this.talkUntil = -1; this.blinkAt = -9; this.icon = null; this.sayOn = false; this.sayK = 0; this.iconK = 0;
      this.gaze = { x: 0, y: 0.3 }; this.gazeGoal = null; this.lookPt = null;
      this.rot = 0; this.extraRot = 0; this.dy = 0; this.sq = 0; this.scale = 1; this.moving = false; this.follow = null;
      const r = this.box();
      const sx = this.o.side === 'left' ? -S : r.w + S;
      this.p = this.o.start === 'offscreen' ? { x: sx, y: r.h * 0.7 } : this.pt(this.o.start);
      this.off = this.o.start === 'offscreen';
      this.prev = { ...this.p };
      this.chain = Promise.resolve();
      this.audio = {};
      if (this.o.sound) this.loadSounds();
      if (this.o.draggable) this.enableDrag();
      if (this.o.clock === 'auto') {
        let last = performance.now();
        const loop = (now) => { if (this.dead) return; this.advance(Math.min(0.1, (now - last) / 1000)); last = now; requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      }
      this.render();
    }

    // ---------- geometry ----------
    box() { const r = this.layer.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width || innerWidth, h: r.height || innerHeight }; }
    pt(t) {
      const b = this.box();
      if (Array.isArray(t)) t = { x: t[0], y: t[1] };
      if (t && typeof t === 'object' && !(t instanceof Element) && 'x' in t) {
        const v = (val, size) => (typeof val === 'string' && val.endsWith('%') ? (parseFloat(val) / 100) * size : +val);
        return { x: v(t.x, b.w), y: v(t.y, b.h) };
      }
      const el = typeof t === 'string' ? document.querySelector(t) : t;
      if (!el) throw new Error('[TenTen] target not found: ' + t);
      const r = el.getBoundingClientRect();
      return { x: r.left - b.x + r.width / 2, y: r.top - b.y + r.height / 2, rect: { x: r.left - b.x, y: r.top - b.y, w: r.width, h: r.height } };
    }
    // a free spot beside an element (right side if there is room, else left, else above)
    spotNear(t) {
      const c = this.pt(t), b = this.box(), g = this.W * 0.75;
      if (!c.rect) return c;
      const { x, y, w, h } = c.rect;
      if (x + w + g * 1.4 < b.w) return { x: x + w + g, y: y + h / 2 };
      if (x - g * 1.4 > 0) return { x: x - g, y: y + h / 2 };
      return { x: x + w / 2, y: Math.max(this.H * 0.6, y - this.H * 0.7) };
    }

    // ---------- clock / queue ----------
    advance(dt) {
      this.t += dt;
      for (const tw of this.tw) { const k = clamp((this.t - tw.t0) / tw.d); tw.fn(tw.e(k), k); }
      this.tw = this.tw.filter((tw) => this.t < tw.t0 + tw.d);
      const due = this.timers.filter((x) => x.at <= this.t);
      this.timers = this.timers.filter((x) => x.at > this.t);
      due.forEach((x) => x.res());
      if (this.follow) this.stepFollow(dt);
      this.render(dt);
    }
    tween(d, fn, e = E.inOut) { const tw = { t0: this.t, d: Math.max(1e-3, d), fn, e }; this.tw.push(tw); return this.sleep(d); }
    sleep(s) { return new Promise((res) => this.timers.push({ at: this.t + s, res })); }
    queue(fn) { const g = this.gen; this.chain = this.chain.then(() => (g === this.gen ? fn() : null)).catch((e) => console.error(e)); return this.chain; }
    // drop everything queued + stop the current move (it stays where it is: never vanishes)
    interrupt() {
      this.gen++; this.chain = Promise.resolve(); this.tw = []; this.timers = [];   // old awaits never resolve, so nothing stale runs later
      this.moving = false; this.mood = 'idle'; this.icon = null; this.sayOn = false; this.talkUntil = -1; this.dy = 0; this.sq = 0; this.extraRot = 0; this.gazeGoal = null;
      return this;
    }

    // ---------- sound ----------
    loadSounds() {
      const emb = root.TenTen && root.TenTen.EMBED;
      for (const s of SFX) { const a = new Audio(emb && emb[s] ? emb[s] : this.o.assets + 'sfx/' + s + '.mp3'); a.preload = 'auto'; this.audio[s] = a; }
    }
    sfx(name, vol = 1) {
      if (!this.o.sound || !this.audio[name] || this.muted) return;
      const a = this.audio[name].cloneNode(); a.volume = clamp(this.o.volume * vol); a.play().catch(() => {});
      this.o.onSound && this.o.onSound(name, this.t);
    }
    mute(m = true) { this.muted = m; return this; }

    // ---------- actions (all queued, all return Promises) ----------
    flyTo(target, o = {}) { return this.queue(() => this._fly(target, o)); }
    _fly(target, o = {}) {
      const a = { ...this.p }, b = o.raw ? target : this.pt(target), dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist < 2) return Promise.resolve();
      const d = o.dur ?? clamp(dist / 750, 0.45, 1.6), lift = o.arc ?? Math.min(110, 20 + dist * 0.18);
      if (o.sound !== false) this.sfx(dist > 500 ? 'whoosh' : 'swoosh', dist > 500 ? 0.55 : 0.35);
      this.moving = true; this.off = false;
      const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - lift;
      return this.tween(d, (k) => {
        const u = 1 - k;
        this.p = { x: u * u * a.x + 2 * u * k * cx + k * k * b.x, y: u * u * a.y + 2 * u * k * cy + k * k * b.y };
      }).then(() => { this.moving = false; this.p = { x: b.x, y: b.y }; });
    }
    enter(o = {}) {
      return this.queue(() => {
        const b = this.box(), to = o.to ? this.pt(o.to) : { x: b.w * (o.from === 'left' ? 0.18 : 0.82), y: b.h * 0.7 };
        const from = o.from || (to.x > b.w / 2 ? 'right' : 'left');
        if (this.off) this.p = { x: from === 'left' ? -this.W : b.w + this.W, y: to.y };
        this.sfx('whoosh', 0.6);
        return this._fly(to, { raw: true, sound: false, dur: o.dur ?? 1.1, arc: 50 }).then(() => this._moodFor('happy', 0.9));
      });
    }
    exit(o = {}) {   // never vanishes: always flies off-screen sideways at the same height
      return this.queue(() => {
        const b = this.box(), to = o.to || (this.p.x > b.w / 2 ? 'right' : 'left');
        this.hideSay(); this.icon = null;
        this.sfx('whoosh', 0.6);
        return this._fly({ x: to === 'left' ? -this.W * 1.2 : b.w + this.W * 1.2, y: this.p.y }, { raw: true, sound: false, dur: o.dur ?? 0.9, arc: 30 })
          .then(() => { this.off = true; });
      });
    }
    say(text, o = {}) {
      return this.queue(() => {
        const d = o.dur ?? clamp(0.8 + String(text).length * 0.065, 1.4, 7);
        this.sayEl.textContent = text; this.sayOn = true; this.talkUntil = this.t + d;
        if (o.mood) this.mood = o.mood;
        this.sfx('pop', 0.5);
        return this.sleep(d).then(() => { if (o.keep) return; this.hideSay(); if (o.mood) this.mood = 'idle'; });
      });
    }
    hideSay() { this.sayOn = false; }
    setMood(name, dur) { return this.queue(() => this._moodFor(name, dur)); }
    _moodFor(name, dur) {
      this.mood = name;
      this.icon = { think: '?', wow: '!', sleepy: 'z' }[name] || null;
      if (name === 'wow') this.sfx('peek', 0.6);
      if (name === 'happy') this.sfx('chime', 0.35);
      if (name === 'think') this.sfx('tick', 0.5);
      if (dur == null) return Promise.resolve();
      return this.sleep(dur).then(() => { this.mood = 'idle'; this.icon = null; });
    }
    think(dur = 1.8) { return this.setMood('think', dur); }
    wow(dur = 1.4) { return this.setMood('wow', dur); }
    happy(dur = 1.4) { return this.setMood('happy', dur); }
    sleepy(dur = 2.5) { return this.setMood('sleepy', dur); }
    lookAt(target) { return this.queue(() => { this.lookPt = target ? this.pt(target) : null; return this.sleep(0.25); }); }
    look(dir = 'center') {
      const g = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], center: [0, 0.3] }[dir] || [0, 0];
      return this.queue(() => { this.lookPt = null; this.gazeGoal = { x: g[0], y: g[1] }; this.sfx('peek', 0.3); return this.sleep(0.35); });
    }
    blink() { return this.queue(() => { this.blinkAt = this.t; this.sfx('blink', 0.5); return this.sleep(0.2); }); }
    hop(n = 1, h = 0.32) {
      return this.queue(async () => { for (let i = 0; i < n; i++) { this.sfx('pop', 0.25); await this.tween(0.36, (e, k) => { this.dy = -Math.sin(k * Math.PI) * this.H * h; this.sq = k < 0.15 || k > 0.85 ? 0.08 : -0.05; }, E.linear); } this.dy = 0; this.sq = 0; });
    }
    nod(n = 2) { return this.queue(async () => { for (let i = 0; i < n; i++) await this.tween(0.32, (e, k) => { this.gazeGoal = { x: 0, y: Math.sin(k * Math.PI) }; this.dy = Math.sin(k * Math.PI) * 6; }, E.linear); this.dy = 0; this.gazeGoal = null; }); }
    shake(n = 2) { return this.queue(() => this.tween(0.25 * n, (e, k) => { this.extraRot = Math.sin(k * Math.PI * 2 * n) * 12; this.gazeGoal = { x: Math.sin(k * Math.PI * 2 * n), y: 0 }; }, E.linear).then(() => { this.extraRot = 0; this.gazeGoal = null; })); }
    spin() { this.sfx('swoosh', 0.4); return this.queue(() => this.tween(0.7, (e) => { this.extraRot = e * 360; }, E.inOut).then(() => { this.extraRot = 0; })); }
    celebrate() {
      return this.queue(async () => {
        this.mood = 'happy'; this.sfx('success', 0.6); this.burst();
        for (let i = 0; i < 2; i++) await this.tween(0.36, (e, k) => { this.dy = -Math.sin(k * Math.PI) * this.H * 0.35; }, E.linear);
        this.dy = 0; await this.sleep(0.6); this.mood = 'idle';
      });
    }
    // fly next to an element, look at it, and ring it
    point(target, o = {}) {
      return this.queue(async () => {
        const c = this.pt(target);
        await this._fly(this.spotNear(target), { raw: true });
        this.lookPt = c; this.sfx('tick', 0.6);
        if (c.rect && o.ring !== false) this.ring(c.rect, o.ringDur ?? 2.2);
        if (o.say) { this.sayEl.textContent = o.say; this.sayOn = true; const d = o.dur ?? clamp(0.8 + o.say.length * 0.065, 1.4, 7); this.talkUntil = this.t + d; this.sfx('pop', 0.5); await this.sleep(d); this.hideSay(); }
        else await this.sleep(o.hold ?? 0.6);
      });
    }
    ring(r, d) {
      const el = document.createElement('div'); el.className = 'tt-ring';
      const pad = 8; Object.assign(el.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px', opacity: 0 });
      this.layer.insertBefore(el, this.el);
      this.tween(d, (e, k) => { el.style.opacity = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1; el.style.transform = `scale(${1 + 0.02 * Math.sin(k * 20)})`; }, E.linear).then(() => el.remove());
    }
    burst(n = 12) {
      const cols = ['#ff1226', '#5035d5', '#ffb800', '#ff8b91'];
      for (let i = 0; i < n; i++) {
        const el = document.createElement('div'); el.className = 'tt-spark';
        el.innerHTML = `<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5Z" fill="${cols[i % 4]}"/></svg>`;
        this.layer.appendChild(el);
        const a = (i / n) * Math.PI * 2 + 0.3, v = this.W * (0.9 + (i % 3) * 0.25);
        this.sparks.push({ el, a, v, t0: this.t, d: 0.9 + (i % 4) * 0.12, x: this.p.x, y: this.p.y });
      }
    }
    // play one of the design team's Lottie animations in place of the body (it keeps bobbing / flying), then hand back
    async lottieData(name) {
      if (!REACTS[name] && name !== 'loading-screen') throw new Error('[TenTen] unknown reaction: ' + name + ' (try: ' + Object.keys(REACTS).join(', ') + ')');
      const base = this.o.assets + 'lottie/';
      if (!root.lottie) await loadScript(base + 'lottie_light.min.js');
      if (!(api.LOTTIE || {})[name]) await loadScript(base + name + '.js');
      return api.LOTTIE[name];
    }
    react(name, o = {}) {
      return this.queue(async () => {
        const data = await this.lottieData(name), cfg = REACTS[name];
        const fr = data.fr, frames = data.op - data.ip, len = frames / fr;
        const d = o.dur ?? len * (o.loops ?? (len < 2 ? 2 : 1));
        const L = (this.W * 0.815) / cfg.w;   // match our body width (measured: 0.815 → same pixel width as the SVG body), centred at (50.3%, 45.3%)
        Object.assign(this.lotEl.style, { width: L + 'px', height: L + 'px', left: this.W * 0.503 - cfg.cx * L + 'px', top: this.H * 0.453 - cfg.cy * L + 'px' });
        this.lotEl.innerHTML = '';
        const anim = root.lottie.loadAnimation({ container: this.lotEl, renderer: 'svg', loop: false, autoplay: false, animationData: JSON.parse(JSON.stringify(data)) });
        this.lot = { anim, t0: this.t, fr, frames, ip: data.ip };
        this.sfx(o.sound ?? cfg.sfx, 0.55);
        if (o.say) { this.sayEl.textContent = o.say; this.sayOn = true; this.talkUntil = this.t + d; }
        await this.sleep(d);
        if (o.say) this.hideSay();
        this.lot = null;
        await this.sleep(0.18);
        if (!this.lot) { anim.destroy(); this.lotEl.innerHTML = ''; }
      });
    }
    cry(dur) { return this.react('cry', { dur }); }
    love(dur) { return this.react('love-eye', { dur }); }
    loading(dur = 2) { return this.react('loading', { dur }); }
    wait(s) { return this.queue(() => this.sleep(s)); }
    // follow an element or the mouse ('mouse'); stop with unfollow()
    followTarget(target = 'mouse') {
      this.follow = target;
      if (target === 'mouse' && !this.mouseOn) { this.mouseOn = true; addEventListener('pointermove', (e) => { const b = this.box(); this.mouse = { x: e.clientX - b.x, y: e.clientY - b.y }; }); }
      this.off = false; return this;
    }
    unfollow() { this.follow = null; return this; }
    stepFollow(dt) {
      let g;
      if (this.follow === 'mouse') { if (!this.mouse) return; g = { x: this.mouse.x + this.W * 0.7, y: this.mouse.y + this.H * 0.2 }; this.lookPt = this.mouse; }
      else g = this.spotNear(this.follow);
      const k = 1 - Math.exp(-dt * 3);
      this.p = { x: this.p.x + (g.x - this.p.x) * k, y: this.p.y + (g.y - this.p.y) * k };
    }
    // run a list of steps: [['enter'], ['say','হাই'], ['point','#a',{say:'এটা দেখো'}], ['exit']]
    play(steps) { let p; for (const [fn, ...args] of steps) p = (fn === 'mood' ? this.setMood : this[fn]).apply(this, args); return p; }
    // drive TenTen from a <video>'s clock: cues = [{ t: 3.2, do: ['say', '...'] }, ...]
    sync(video, cues) {
      const v = typeof video === 'string' ? document.querySelector(video) : video;
      const list = cues.map((c) => ({ ...c, fired: false })).sort((a, b) => a.t - b.t);
      let last = 0;
      const check = () => {
        const t = v.currentTime;
        if (t < last - 0.25 || t > last + 1.5) { this.interrupt(); list.forEach((c) => { c.fired = c.t < t - 1.5; }); }   // seeked: reset + replay from here
        for (const c of list) if (!c.fired && t >= c.t && t - c.t < 1.5) { c.fired = true; const [fn, ...args] = c.do; (fn === 'mood' ? this.setMood : this[fn]).apply(this, args); }
        last = t; if (!this.dead) requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
      return this;
    }
    enableDrag() {
      this.el.classList.add('tt-grab');
      let drag = null;
      this.el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX - this.p.x, y: e.clientY - this.p.y, moved: false }; this.el.setPointerCapture(e.pointerId); });
      this.el.addEventListener('pointermove', (e) => { if (!drag) return; drag.moved = true; this.p = { x: e.clientX - drag.x, y: e.clientY - drag.y }; });
      this.el.addEventListener('pointerup', () => { if (drag && !drag.moved) (this.o.onClick ? this.o.onClick(this) : this.hop(1)); drag = null; });
    }
    destroy() { this.dead = true; this.layer.remove(); }

    // ---------- draw one frame ----------
    render(dt = 0) {
      const t = this.t, S = this.W / 150, n = this.n;
      const talk = t < this.talkUntil && !this.moving, happy = this.mood === 'happy', moving = this.moving;
      const idle = !moving && !this.follow;
      const bobX = idle ? Math.sin(t * 1.3) * 10 * S * this.o.bob : 0, bobY = idle ? Math.sin(t * 2.2) * 9 * S * this.o.bob : 0;
      // tilt from velocity
      const vx = dt ? (this.p.x - this.prev.x) / dt : 0;
      this.rot += (clamp(vx * 0.03, -14, 14) - this.rot) * (dt ? 1 - Math.exp(-dt * 10) : 1);
      this.prev = { ...this.p };
      // gaze
      let g = this.gazeGoal;
      if (!g && moving) g = { x: Math.sign(vx) || 0, y: 0 };
      if (!g && this.lookPt) { const dx = this.lookPt.x - this.p.x, dy = this.lookPt.y - this.p.y, L = Math.hypot(dx, dy) || 1; g = { x: dx / L, y: dy / L }; }
      if (this.mood === 'think') g = { x: 0.6, y: -0.8 };
      if (!g) g = { x: 0, y: 0.3 };
      const gk = dt ? 1 - Math.exp(-dt * 14) : 1;
      this.gaze = { x: this.gaze.x + (g.x - this.gaze.x) * gk, y: this.gaze.y + (g.y - this.gaze.y) * gk };
      // eyes
      const sleepy = this.mood === 'sleepy';
      const blink = (t % 3.9 < 0.12 && !happy) || (t - this.blinkAt >= 0 && t - this.blinkAt < 0.14);
      const bl = sleepy ? 0.14 : blink ? 0.1 : 1;
      n.open.setAttribute('transform', `translate(0 ${(77 * (1 - bl)).toFixed(2)}) scale(1 ${bl})`);
      n.open.style.opacity = happy ? 0 : 1; n.happy.style.opacity = happy ? 1 : 0;
      n.eyes.setAttribute('transform', this.mood === 'wow' ? 'translate(80 77) scale(1.2) translate(-80 -77)' : '');
      n.face.setAttribute('transform', `translate(${(this.gaze.x * 7).toFixed(1)} ${(this.gaze.y * 6).toFixed(1)})`);
      n.blush.setAttribute('opacity', happy ? 0.9 : 0.25);
      n.eyes.style.filter = talk ? `drop-shadow(0 0 ${(5 + 4 * Math.abs(Math.sin(t * 9))).toFixed(1)}px #fff) drop-shadow(0 0 14px #fff9dc)` : 'none';
      const sq = this.sq || (moving ? 0.04 : 0.025 * Math.sin(t * 1.7) + (talk ? 0.012 * Math.sin(t * 8) : 0));
      n.body.setAttribute('transform', `translate(80 145) scale(${(1 + sq).toFixed(3)} ${(1 - sq).toFixed(3)}) translate(-80 -145)`);
      const x = this.p.x + bobX, y = this.p.y + bobY + this.dy + (talk ? Math.sin(t * 7) * 3 : 0);
      this.el.style.transform = `translate(${(x - this.W / 2).toFixed(1)}px,${(y - this.H / 2).toFixed(1)}px) rotate(${(this.rot + this.extraRot).toFixed(2)}deg) scale(${this.scale})`;
      // speech bubble: above, on the side with more room
      const b = this.box(), left = x > b.w * 0.55;
      this.sayK += ((this.sayOn ? 1 : 0) - this.sayK) * (dt ? 1 - Math.exp(-dt * 16) : 1);
      if (this.sayK > 0.01) {
        const w = this.sayEl.offsetWidth, h = this.sayEl.offsetHeight, top = y - this.H * 0.55 - h - 14;
        const sx = left ? x - w + this.W * 0.15 : x - this.W * 0.15;
        this.sayEl.style.setProperty('--tt-tail', (left ? w - this.W * 0.35 : this.W * 0.2) + 'px');
        this.sayEl.style.setProperty('--tt-ox', (left ? '85%' : '15%'));
        this.sayEl.style.transform = `translate(${clamp(sx, 8, b.w - w - 8).toFixed(1)}px,${Math.max(8, top).toFixed(1)}px) scale(${(0.6 + 0.4 * this.sayK).toFixed(3)})`;
      }
      this.sayEl.style.opacity = this.sayK.toFixed(3);
      // icon bubble (? ! z)
      this.iconK += ((this.icon ? 1 : 0) - this.iconK) * (dt ? 1 - Math.exp(-dt * 14) : 1);
      if (this.icon) this.iconEl.textContent = this.icon;
      const iw = this.iconEl.offsetWidth || 30;
      this.iconEl.style.transform = `translate(${(x + this.W * 0.38 - iw / 2).toFixed(1)}px,${(y - this.H * 0.62 - iw + Math.sin(t * 3) * 6).toFixed(1)}px) scale(${(0.5 + 0.5 * this.iconK).toFixed(3)})`;
      this.iconEl.style.opacity = this.iconK.toFixed(3);
      // design-team Lottie: frame comes from TenTen's own clock, body cross-fades
      this.lotK += ((this.lot ? 1 : 0) - this.lotK) * (dt ? 1 - Math.exp(-dt * 22) : 1);
      if (this.lot) { const f = ((t - this.lot.t0) * this.lot.fr) % this.lot.frames; this.lot.anim.goToAndStop(this.lot.ip + f, true); }
      this.lotEl.style.opacity = this.lotK.toFixed(3);
      n.svg.style.opacity = (1 - this.lotK).toFixed(3);
      // sparks
      this.sparks = this.sparks.filter((s) => {
        const k = (t - s.t0) / s.d;
        if (k >= 1) { s.el.remove(); return false; }
        const e = E.out(k), sx2 = s.x + Math.cos(s.a) * s.v * e, sy2 = s.y + Math.sin(s.a) * s.v * e + 60 * k * k;
        s.el.style.transform = `translate(${sx2 - 9}px,${sy2 - 9}px) rotate(${k * 180}deg) scale(${1 - k * 0.6})`;
        s.el.style.opacity = 1 - k * k;
        return true;
      });
    }
  }

  const api = {
    create: (o) => new Tenten(o),
    svg: () => svgMarkup('S'),
    MOODS, SFX, version: '1.1.0',
    EMBED: (root.TenTen && root.TenTen.EMBED) || null,
    LOTTIE: (root.TenTen && root.TenTen.LOTTIE) || {},
    REACTIONS: Object.keys(REACTS),
  };
  root.TenTen = api;
})(typeof window !== 'undefined' ? window : globalThis);
