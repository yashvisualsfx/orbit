'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const {
  APPS_FILE,
  BUILD,
  CONFIG_FILE,
  DATA_DIR,
  ICON_DIR,
} = require('./paths');

const FALLBACK_RELAY = 'ws://127.0.0.1:8080';
const FALLBACK_WEB = 'http://localhost:3000';

/**
 * Which relay this agent talks to, in order of precedence: the ORBIT_RELAY
 * environment variable, then a relay.txt sitting next to the executable (so a
 * download can be re-pointed without a rebuild), then the URL stamped into the
 * build, then localhost for development.
 */
function stampedUrl(envName, fileName, baked, fallback) {
  if (process.env[envName]) return process.env[envName].trim();

  // Next to the exe for a packaged build, next to src/ when run from source.
  for (const dir of [path.dirname(process.execPath), path.join(__dirname, '..')]) {
    try {
      const fromFile = fs.readFileSync(path.join(dir, fileName), 'utf8').trim();
      if (fromFile) return fromFile;
    } catch {
      /* not stamped this way */
    }
  }

  return baked || fallback;
}

const DEFAULT_RELAY = stampedUrl('ORBIT_RELAY', 'relay.txt', BUILD.relay, FALLBACK_RELAY);
const WEB_URL = stampedUrl('ORBIT_WEB', 'web.txt', BUILD.web, FALLBACK_WEB);

function ensureDirs() {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * The device key is the root secret. The public device id is derived from it by
 * hash, so the relay can verify that an agent owns the id it claims without the
 * id itself being guessable.
 */
function deviceIdFromKey(deviceKey) {
  const hash = crypto.createHash('sha256').update(String(deviceKey)).digest('hex');
  return `ORB-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`;
}

function load() {
  ensureDirs();
  let cfg = readJson(CONFIG_FILE, null);

  if (!cfg || !cfg.deviceKey) {
    const deviceKey = crypto.randomBytes(32).toString('hex');
    cfg = {
      deviceKey,
      deviceId: deviceIdFromKey(deviceKey),
      // Signs the tokens handed to paired browsers. Rotating it logs everyone out.
      tokenSecret: crypto.randomBytes(32).toString('hex'),
      pin: String(crypto.randomInt(0, 1000000)).padStart(6, '0'),
      name: os.hostname(),
      relay: DEFAULT_RELAY,
      clients: [],      // { id, label, pairedAt }
      favorites: [],
      allowPower: true,
    };
    save(cfg);
  }

  cfg.clients = cfg.clients || [];
  cfg.favorites = cfg.favorites || [];
  cfg.relay = DEFAULT_RELAY || cfg.relay;
  if (typeof cfg.allowPower !== 'boolean') cfg.allowPower = true;
  return cfg;
}

function save(cfg) {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ------------------------------------------------------------------ tokens
// A token is "<clientId>.<hmac>". Verification is a signature check plus a
// lookup in the paired list, so revoking one phone does not disturb the others.

function issueToken(cfg, label) {
  const id = crypto.randomBytes(12).toString('hex');
  cfg.clients.push({ id, label: label || 'Browser', pairedAt: new Date().toISOString() });
  if (cfg.clients.length > 30) cfg.clients = cfg.clients.slice(-30);
  save(cfg);
  return `${id}.${signClient(cfg, id)}`;
}

function signClient(cfg, id) {
  return crypto.createHmac('sha256', cfg.tokenSecret).update(id).digest('hex').slice(0, 32);
}

function verifyToken(cfg, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [id, sig] = token.split('.');
  const expected = signClient(cfg, id);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  return cfg.clients.find((c) => c.id === id) || null;
}

function revokeAll(cfg) {
  cfg.clients = [];
  cfg.tokenSecret = crypto.randomBytes(32).toString('hex');
  save(cfg);
}

/**
 * Stops a second copy of the agent from fighting the first for the relay
 * connection — the logon task and a manual start would otherwise both run.
 * Returns false when another live agent already holds the lock.
 */
function claimSingleInstance() {
  ensureDirs();
  const lockFile = path.join(DATA_DIR, 'agent.pid');

  try {
    const existing = Number(fs.readFileSync(lockFile, 'utf8').trim());
    if (existing && existing !== process.pid) {
      // Signal 0 tests for existence without touching the process.
      process.kill(existing, 0);
      return false;
    }
  } catch {
    /* no lock file, or the recorded process is gone */
  }

  fs.writeFileSync(lockFile, String(process.pid), 'utf8');
  const release = () => {
    try {
      if (fs.readFileSync(lockFile, 'utf8').trim() === String(process.pid)) {
        fs.unlinkSync(lockFile);
      }
    } catch {
      /* already removed */
    }
  };
  process.on('exit', release);
  return true;
}

module.exports = {
  DATA_DIR,
  CONFIG_FILE,
  claimSingleInstance,
  ICON_DIR,
  APPS_FILE,
  DEFAULT_RELAY,
  WEB_URL,
  ensureDirs,
  deviceIdFromKey,
  load,
  save,
  issueToken,
  verifyToken,
  revokeAll,
};
