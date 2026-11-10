'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('./config');
const { log } = require('./log');
const { runScan } = require('./ps');

const INVITE_TTL_MS = 5 * 60 * 1000;

/** "Windows 11 (26200)" reads better than os.type()'s "Windows_NT 10.0.26200". */
function prettyPlatform() {
  const release = os.release();
  const build = Number(release.split('.')[2] || 0);
  if (os.platform() !== 'win32') return `${os.type()} ${release}`;
  // Windows 11 kept the 10.0 major version and is identified by build number.
  return `${build >= 22000 ? 'Windows 11' : 'Windows 10'} (build ${build})`;
}

/**
 * Every command a paired browser can run, plus the app index the agent keeps
 * in memory. `pair` is the only command reachable without a valid token; the
 * dispatcher below enforces that.
 */
class Commands {
  constructor(host, cfg) {
    this.host = host;
    this.cfg = cfg;
    this.appsPayload = null;
    this.appIndex = new Map();
    this.scanning = false;
    // A short-lived second way to pair, handed out by an already-paired browser.
    this.invite = null;
    this.loadApps();
  }

  loadApps() {
    try {
      this.appsPayload = JSON.parse(fs.readFileSync(config.APPS_FILE, 'utf8'));
    } catch {
      this.appsPayload = null;
    }
    this.appIndex = new Map();
    if (this.appsPayload && Array.isArray(this.appsPayload.apps)) {
      for (const a of this.appsPayload.apps) this.appIndex.set(a.id, a);
    }
  }

  get appCount() {
    return this.appIndex.size;
  }

  async scan(onProgress) {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await runScan(config.ICON_DIR, config.APPS_FILE, onProgress);
      this.loadApps();
    } finally {
      this.scanning = false;
    }
  }

  /**
   * Identifies the current icon pack without reading it.
   *
   * The agent sends this when it connects, so a relay that already holds this
   * exact pack can say "do not bother" - otherwise every reconnect, and a PC
   * that sleeps reconnects often, would re-upload a few megabytes of icons.
   */
  iconSignature() {
    const parts = [];
    for (const app of this.appIndex.values()) {
      if (!app.icon) continue;
      try {
        const { size } = fs.statSync(path.join(config.ICON_DIR, app.icon));
        parts.push(`${app.id}:${app.icon}:${size}`);
      } catch { /* icon disappeared between scans */ }
    }
    if (!parts.length) return '';

    parts.sort();
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  }

  /** Every scanned icon as base64, for the relay to serve over HTTP. */
  iconPack() {
    const pack = {};
    for (const app of this.appIndex.values()) {
      if (!app.icon) continue;
      try {
        pack[app.id] = fs.readFileSync(path.join(config.ICON_DIR, app.icon)).toString('base64');
      } catch { /* icon disappeared between scans */ }
    }
    return pack;
  }

  /** True once, for a code that is current. */
  consumeInvite(code) {
    const invite = this.invite;
    if (!invite || !code) return false;
    if (Date.now() > invite.expiresAt) {
      this.invite = null;
      return false;
    }
    if (String(code) !== invite.code) return false;

    this.invite = null;
    return true;
  }

  deviceInfo() {
    return {
      id: this.cfg.deviceId,
      name: this.cfg.name,
      platform: prettyPlatform(),
      appCount: this.appCount,
      agentVersion: require('../package.json').version,
    };
  }

  // ------------------------------------------------------------ dispatch
  async run(cmd, args, client) {
    const a = args || {};

    switch (cmd) {
      case 'device.info':
        return this.deviceInfo();

      case 'device.clients':
        return { clients: this.cfg.clients.map((c) => ({ label: c.label, pairedAt: c.pairedAt })) };

      case 'device.unpairAll':
        config.revokeAll(this.cfg);
        return { ok: true };

      /*
       * Lets a paired phone add another device without anyone reading the PIN
       * off the PC. The code is single-use and expires in five minutes, so a QR
       * code left on screen stops working on its own.
       */
      case 'device.invite': {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        this.invite = { code, expiresAt: Date.now() + INVITE_TTL_MS };
        return { code, expiresIn: Math.round(INVITE_TTL_MS / 1000) };
      }

      // -------------------------------------------------------------- apps
      case 'apps.list':
        return {
          apps: this.appsPayload ? this.appsPayload.apps : [],
          favorites: this.cfg.favorites,
          scannedAt: this.appsPayload ? this.appsPayload.scannedAt : null,
          scanning: this.scanning,
        };

      case 'apps.launch': {
        const entry = this.appIndex.get(String(a.id || ''));
        if (!entry) throw new Error('That app is no longer installed');
        const out = await this.host.send('launch', { method: entry.method, target: entry.target });
        if (!out.ok) throw new Error(out.error || 'Could not start the app');
        return { name: entry.name };
      }

      case 'apps.favorite': {
        const id = String(a.id || '');
        if (!this.appIndex.has(id)) throw new Error('Unknown app');
        const set = new Set(this.cfg.favorites);
        if (a.on) set.add(id); else set.delete(id);
        this.cfg.favorites = [...set];
        config.save(this.cfg);
        return { favorites: this.cfg.favorites };
      }

      case 'apps.rescan':
        if (this.scanning) return { scanning: true };
        this.scan().catch((err) => log.error('rescan failed:', err.message));
        return { started: true };

      // ------------------------------------------------------------ system
      case 'sys.status':
        return this.forward('status');

      case 'sys.volume':
        return this.forward('volume', { value: Number(a.value) });

      case 'sys.mute':
        return this.forward('mute', { value: a.value });

      case 'sys.media':
        return this.forward('media', { key: String(a.key || '') });

      case 'sys.key':
        return this.forward('key', { value: String(a.value || '') });

      case 'sys.type':
        return this.forward('type', { text: String(a.text || '') });

      case 'sys.power': {
        if (!this.cfg.allowPower) throw new Error('Power controls are disabled on this PC');
        const action = String(a.action || '');
        log(`power: ${action} (requested by ${client ? client.label : 'unknown'})`);
        return this.forward('power', { action });
      }

      // ----------------------------------------------------------- windows
      case 'win.list':
        return this.forward('running');

      case 'win.focus':
        return this.forward('focus', { pid: Number(a.pid), hwnd: Number(a.hwnd) || 0 });

      case 'win.close':
        return this.forward('kill', { pid: Number(a.pid) });

      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
  }

  async forward(psCommand, payload) {
    const out = await this.host.send(psCommand, payload || {});
    if (!out.ok) throw new Error(out.error || `${psCommand} failed`);
    delete out.id;
    delete out.ok;
    return out;
  }
}

module.exports = { Commands };
