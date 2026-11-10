#!/usr/bin/env node
/**
 * Builds Orbit.exe — a single file that needs no Node.js on the target PC.
 *
 *   node scripts/build-exe.mjs [--relay wss://...] [--web https://...]
 *
 * Two things happen here that are worth knowing about.
 *
 * 1. The relay and website URLs are stamped into agent/src/build.json before
 *    bundling, so a downloaded exe knows where to phone home without any
 *    configuration on the user's side.
 *
 * 2. The finished binary's PE subsystem is flipped from console to GUI. pkg can
 *    only produce console programs, and a console program started by the logon
 *    task flashes a black window on every sign-in. Flipping the subsystem byte
 *    makes Windows start it with no console at all — which is why the agent logs
 *    to a file instead of stdout.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = path.join(ROOT, 'agent');
const OUT_DIR = path.join(AGENT, 'dist');
const EXE = path.join(OUT_DIR, 'Orbit.exe');
const PUBLIC_EXE = path.join(ROOT, 'web', 'public', 'Orbit.exe');

const DEFAULTS = {
  relay: 'wss://orbit-sjdy.onrender.com',
  web: 'https://orbit-rho-ecru.vercel.app',
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
  console.error(`--web must be an http(s) URL, got "${web}"`);
  process.exit(1);
}

// ------------------------------------------------------------------- stamp
const buildFile = path.join(AGENT, 'src', 'build.json');
fs.writeFileSync(buildFile, JSON.stringify({ relay, web }, null, 2) + '\n');
console.log(`stamped  relay ${relay}`);
console.log(`stamped  web   ${web}`);

// ------------------------------------------------------------------ bundle
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

// ------------------------------------------------- console -> GUI subsystem
function makeWindowless(file) {
  const buf = fs.readFileSync(file);
  const peOffset = buf.readUInt32LE(0x3c);

  if (buf.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
    throw new Error('not a PE image: missing the PE signature');
  }

  // 4 bytes of signature + 20 bytes of COFF header, then the optional header,
  // whose Subsystem field sits at offset 68 in both PE32 and PE32+.
  const subsystem = peOffset + 4 + 20 + 68;
  const current = buf.readUInt16LE(subsystem);

  if (current === 2) return 'already windowless';
  if (current !== 3) throw new Error(`unexpected subsystem ${current}, refusing to patch`);

  buf.writeUInt16LE(2, subsystem);
  fs.writeFileSync(file, buf);
  return 'patched console -> GUI';
}

console.log(`subsystem: ${makeWindowless(EXE)}`);

// ------------------------------------------------------------------ publish
fs.mkdirSync(path.dirname(PUBLIC_EXE), { recursive: true });
fs.copyFileSync(EXE, PUBLIC_EXE);

const bytes = fs.statSync(EXE).size;
const sha = createHash('sha256').update(fs.readFileSync(EXE)).digest('hex');

console.log('');
console.log(`  ${EXE}`);
console.log(`  ${PUBLIC_EXE}`);
console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB   sha256 ${sha.slice(0, 16)}…`);
console.log('');
console.log('  Deploy the website so /Orbit.exe serves the new build:');
console.log('    cd web && vercel --prod --yes');
console.log('');
