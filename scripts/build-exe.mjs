#!/usr/bin/env node
/**
 * Builds Orbit.exe — a single file that needs no Node.js on the target PC.
 *
 *   node scripts/build-exe.mjs [--relay wss://...] [--web https://...]
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = path.join(ROOT, 'agent');
const OUT_DIR = path.join(AGENT, 'dist');
const EXE = path.join(OUT_DIR, 'Orbit.exe');
const PRIVATE_EXE = path.join(ROOT, 'web', 'private', 'Orbit.exe');

const BUILD_FILE = path.join(AGENT, 'src', 'build.json');
let stamped = {};
try { stamped = JSON.parse(fs.readFileSync(BUILD_FILE, 'utf8')); } catch { /* use safe defaults below */ }

// Preserve the relay already stamped into the agent unless an explicit --relay
// is supplied. This avoids silently moving a working install to another host.
const DEFAULTS = {
  relay: stamped.relay || 'wss://orbit-sjdy.onrender.com',
  web: stamped.web || 'https://orbit-rho-ecru.vercel.app',
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const relay = arg('relay', DEFAULTS.relay).replace(/\/$/, '');
const web = arg('web', DEFAULTS.web).replace(/\/$/, '');

if (!/^wss?:\/\//.test(relay)) {
  console.error(`--relay must be a ws:// or wss:// URL, got "${relay}"`);
  process.exit(1);
}
if (!/^https?:\/\//.test(web)) {
  console.error(`--web must be an http(s):// URL, got "${web}"`);
  process.exit(1);
}

fs.writeFileSync(BUILD_FILE, JSON.stringify({ relay, web }, null, 2) + '\n');
console.log(`stamped  relay ${relay}`);
console.log(`stamped  web   ${web}`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const pkgBin = path.join(
  AGENT, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js'
);
if (!fs.existsSync(pkgBin)) {
  console.error('@yao-pkg/pkg is not installed. Run: cd agent && npm install');
  process.exit(1);
}

const build = spawnSync(
  process.execPath,
  [pkgBin, '.', '--target', 'node22-win-x64', '--output', EXE, '--compress', 'Brotli'],
  { cwd: AGENT, stdio: 'inherit' }
);

if (build.status !== 0) {
  console.error('\npkg failed. If it could not fetch a base binary, check your connection.');
  process.exit(build.status ?? 1);
}

// pkg appends its payload to the executable. Use resedit (not rcedit) to safely
// update the PE resources without damaging that embedded payload.
function createOrbitIco(file) {
  const size = 256;
  const rgba = Buffer.alloc(size * size * 4);
  const mix = (a, b, t) => a + (b - a) * t;
  const insideRoundRect = (x, y, left, top, right, bottom, radius) => {
    const cx = Math.max(left + radius, Math.min(x, right - radius));
    const cy = Math.max(top + radius, Math.min(y, bottom - radius));
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const sample = (x, y) => {
    if (!insideRoundRect(x, y, 18, 18, 238, 238, 48)) return [0, 0, 0, 0];
    const t = Math.max(0, Math.min(1, y / size));
    let color = [mix(7, 17, t), mix(18, 35, t), mix(39, 66, t), 255];

    const dx = x - 128, dy = y - 128;
    const angle = -28 * Math.PI / 180;
    const ex = dx * Math.cos(angle) + dy * Math.sin(angle);
    const ey = -dx * Math.sin(angle) + dy * Math.cos(angle);
    const ellipse = Math.abs(Math.sqrt((ex / 105) ** 2 + (ey / 46) ** 2) - 1) * 46;
    const ring = Math.abs(Math.hypot(dx, dy) - 48);
    const dot = Math.hypot(x - 216, y - 73);

    const blend = (c, alpha) => {
      color = color.map((v, i) => i === 3 ? 255 : Math.round(mix(v, c[i], alpha)));
    };
    if (ellipse < 3.2) blend([108, 194, 255], 0.86);
    else if (ellipse < 5.5) blend([62, 143, 226], 0.28);
    if (ring < 3.5) blend([239, 247, 255], 0.96);
    if (dot < 15) blend([115, 203, 255], 0.98);
    if (dot < 8) blend([232, 247, 255], 1);
    return color;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const samples = [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]];
      const colors = samples.map(([sx,sy]) => sample(x + sx, y + sy));
      const out = [0,1,2,3].map((i) => Math.round(colors.reduce((sum,c) => sum + c[i],0) / 4));
      const o = (y * size + x) * 4;
      rgba[o] = out[2]; rgba[o+1] = out[1]; rgba[o+2] = out[0]; rgba[o+3] = out[3];
    }
  }

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = y * size * 4;
    const dst = (size - 1 - y) * size * 4;
    rgba.copy(xor, dst, src, src + size * 4);
  }
  const maskRow = Math.ceil(size / 32) * 4;
  const andMask = Buffer.alloc(maskRow * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rgba[(y * size + x) * 4 + 3] === 0) {
        const offset = (size - 1 - y) * maskRow + (x >> 3);
        andMask[offset] |= 0x80 >> (x & 7);
      }
    }
  }

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(xor.length + andMask.length, 20);
  const imageData = Buffer.concat([dib, xor, andMask]);
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(imageData.length, 14);
  header.writeUInt32LE(header.length, 18);
  fs.writeFileSync(file, Buffer.concat([header, imageData]));
}

async function applyOrbitIcon(file) {
  const requireAgent = createRequire(path.join(AGENT, 'package.json'));
  const { load } = requireAgent('resedit/cjs');
  const ResEdit = await load();
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(EXE));
  const resources = ResEdit.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  if (!groups.length) throw new Error('No icon group found in the packaged Windows executable.');
  const iconPath = path.join(OUT_DIR, 'orbit.ico');
  createOrbitIco(iconPath);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const group = groups[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries,
    group.id,
    group.lang,
    iconFile.icons.map((item) => item.data)
  );
  resources.outputResource(exe);
  fs.writeFileSync(EXE, Buffer.from(exe.generate()));
  console.log('icon: Orbit orbital logo embedded in EXE');
}

try {
  await applyOrbitIcon();
} catch (error) {
  console.error('Could not embed the Orbit EXE icon:', error);
  process.exit(1);
}

fs.mkdirSync(path.dirname(PRIVATE_EXE), { recursive: true });
fs.copyFileSync(EXE, PRIVATE_EXE);

const bytes = fs.statSync(EXE).size;
const sha = createHash('sha256').update(fs.readFileSync(EXE)).digest('hex');

console.log('');
console.log(`  ${EXE}`);
console.log(`  ${PUBLIC_EXE}`);
console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB   sha256 ${sha.slice(0, 16)}…`);
console.log('');
console.log('  Upload this file to the private Supabase Storage bucket: orbit-downloads / Orbit.exe');
console.log('  The signed-in website will issue a short-lived download link.');
