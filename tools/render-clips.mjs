// Renders transparent TenTen clips (mov ProRes 4444 + webm VP9 alpha + gif) and mood stills (png + svg).
// usage: node tools/render-clips.mjs [clipName ...]      (no args = everything)
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FPS = 30, only = process.argv.slice(2);
const SQ = { w: 640, h: 640, size: 300, at: [320, 380] }, WIDE = { w: 1280, h: 640, size: 300, at: [640, 380] };
// each clip: stage box, duration, and a setup script run in the page (tt = instance, W/H = stage size)
const CLIPS = {
  idle:        { ...SQ, dur: 4, js: `` },
  talk:        { ...SQ, dur: 4, js: `tt.talkUntil = 1e9;` },
  think:       { ...SQ, dur: 3, js: `tt.think(99);` },
  wow:         { ...SQ, dur: 2.5, js: `tt.wait(0.4); tt.wow(99);` },
  happy:       { ...SQ, dur: 3, js: `tt.setMood('happy'); tt.wait(0.6); tt.hop(1);` },
  sleepy:      { ...SQ, dur: 4, js: `tt.sleepy(99);` },
  celebrate:   { ...SQ, dur: 2.6, js: `tt.wait(0.2); tt.celebrate();` },
  nod:         { ...SQ, dur: 2.2, js: `tt.wait(0.3); tt.nod(2);` },
  shake:       { ...SQ, dur: 2.2, js: `tt.wait(0.3); tt.shake(3);` },
  'look-around': { ...SQ, dur: 4, js: `tt.wait(0.3); tt.look('left'); tt.wait(0.6); tt.look('right'); tt.wait(0.6); tt.look('up'); tt.wait(0.6); tt.look('center'); tt.blink();` },
  'enter-left':  { ...WIDE, dur: 2.4, off: 'left', js: `tt.enter({ from: 'left', to: { x: W / 2, y: ${WIDE.at[1]} } });` },
  'enter-right': { ...WIDE, dur: 2.4, off: 'right', js: `tt.enter({ from: 'right', to: { x: W / 2, y: ${WIDE.at[1]} } });` },
  'exit-right':  { ...WIDE, dur: 1.8, js: `tt.wait(0.3); tt.exit({ to: 'right' });` },
  'exit-left':   { ...WIDE, dur: 1.8, js: `tt.wait(0.3); tt.exit({ to: 'left' });` },
};
const STILLS = { idle: ``, happy: `tt.happy(99);`, think: `tt.think(99);`, wow: `tt.wow(99);`, sleepy: `tt.sleepy(99);`, talk: `tt.talkUntil = 1e9;`,
  'look-left': `tt.look('left');`, 'look-right': `tt.look('right');` };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto('file://' + path.join(root, 'tools/stage.html'));
await page.evaluate(() => document.fonts.load("800 40px 'Baloo Da 2'", '?!z'));

async function setup(c, js) {
  await page.setViewportSize({ width: c.w, height: c.h });
  await page.evaluate(({ c, js }) => {
    document.getElementById('stage').innerHTML = '';
    Object.assign(document.getElementById('stage').style, { width: c.w + 'px', height: c.h + 'px' });
    window.W = c.w; window.H = c.h; window.SND = [];
    window.tt = TenTen.create({ parent: '#stage', size: c.size, clock: 'manual', sound: false, bob: 1,
      start: c.off ? 'offscreen' : { x: c.at[0], y: c.at[1] }, side: c.off || 'right' });
    tt.o.sound = true; tt.audio = new Proxy({}, { get: () => true });   // record sounds instead of playing them
    tt.sfx = (name, vol = 1) => window.SND.push([name, tt.t, vol]);
    tt.advance(0);
    new Function('tt', js)(tt);
  }, { c, js });
}
const step = () => page.evaluate((dt) => { tt.advance(dt); return new Promise((r) => setTimeout(r, 0)); }, 1 / FPS);

fs.mkdirSync(path.join(root, 'clips'), { recursive: true });
for (const [name, c] of Object.entries(CLIPS)) {
  if (only.length && !only.includes(name)) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
  await setup(c, c.js);
  const n = Math.round(c.dur * FPS);
  for (let i = 0; i < n; i++) {
    await step();
    await page.screenshot({ path: path.join(tmp, String(i).padStart(4, '0') + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: c.w, height: c.h } });
  }
  const snd = await page.evaluate(() => window.SND);
  const base = path.join(root, 'clips', 'tenten-' + name), frames = path.join(tmp, '%04d.png');
  // audio track from the recorded sfx (the same wavs that ship in assets/sfx-wav)
  const aIn = [], aF = [];
  snd.forEach(([s, t, v], i) => { aIn.push('-i', path.join(root, 'assets/sfx-wav', s + '.wav')); aF.push(`[${i + 1}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=${(v * 0.6).toFixed(2)}[a${i}]`); });
  const audio = snd.length ? ['-filter_complex', aF.join(';') + ';' + snd.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${snd.length}:normalize=0,apad,atrim=0:${c.dur}[aout]`, '-map', '0:v', '-map', '[aout]'] : [];
  const run = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]); if (r.status) throw new Error(r.stderr.toString()); };
  run(['-framerate', FPS, '-i', frames, ...aIn, ...audio, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', ...(snd.length ? ['-c:a', 'pcm_s16le'] : []), base + '.mov']);
  run(['-framerate', FPS, '-i', frames, ...aIn, ...audio, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1', ...(snd.length ? ['-c:a', 'libopus'] : []), base + '.webm']);
  run(['-framerate', FPS, '-i', frames, '-vf', `fps=20,scale=${c.w / 2}:-1:flags=lanczos,split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=alpha_threshold=128`, '-loop', '0', base + '.gif']);
  fs.rmSync(tmp, { recursive: true });
  console.log('clip', name, snd.length ? `(${snd.length} sfx)` : '');
}

if (!only.length || only.includes('stills')) {
  for (const [name, js] of Object.entries(STILLS)) {
    await setup({ w: 512, h: 512, size: 280, at: [256, 330] }, js);
    for (let i = 0; i < 30; i++) await step();
    await page.evaluate(() => { tt.t = 1.0; tt.blinkAt = -9; tt.advance(0); });   // t=1.0 → eyes open, mid-bob
    await page.screenshot({ path: path.join(root, 'assets/png', `tenten-${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
    const svg = await page.evaluate(() => tt.el.querySelector('svg').outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="360" '));
    fs.writeFileSync(path.join(root, 'assets/svg', `tenten-${name}.svg`), svg.replace(/width="100%" height="100%" /, ''));
  }
  console.log('stills done');
}
await browser.close();
