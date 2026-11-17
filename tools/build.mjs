// Builds tenten.bundle.js = tenten.js with every sound inlined (base64 mp3) → one file, nothing else needed.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sfx = {};
for (const f of fs.readdirSync(path.join(root, 'assets/sfx')).filter((f) => f.endsWith('.mp3')))
  sfx[path.basename(f, '.mp3')] = 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(root, 'assets/sfx', f)).toString('base64');
const src = fs.readFileSync(path.join(root, 'tenten.js'), 'utf8');
fs.writeFileSync(path.join(root, 'tenten.bundle.js'), `/* TenTen bundle: tenten.js + inlined sounds */\n(function(r){r.TenTen=Object.assign(r.TenTen||{},{EMBED:${JSON.stringify(sfx)}});})(typeof window!=='undefined'?window:globalThis);\n` + src);
console.log('tenten.bundle.js', (fs.statSync(path.join(root, 'tenten.bundle.js')).size / 1024).toFixed(0) + ' KB,', Object.keys(sfx).length, 'sounds');
