'use strict';

const { spawn } = require('child_process');
const readline = require('readline');

const { scriptPath } = require('./paths');
const { log } = require('./log');

const REQUEST_TIMEOUT_MS = 20000;

/**
 * Wraps the long-lived host.ps1 worker. Commands are written as one JSON line
 * and matched back to their reply by id. The process is respawned if it dies.
 */
class PowerShellHost {
  constructor() {
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.readyPromise = null;
    this.stopping = false;
  }

  start() {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath('host.ps1')],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      this.child = child;
      let ready = false;

      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        line = line.trim();
        if (!line.startsWith('{')) return;

        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }

        if (msg.ready && !ready) {
          ready = true;
          resolve(this);
          return;
        }

        const slot = this.pending.get(msg.id);
        if (slot) {
          this.pending.delete(msg.id);
          clearTimeout(slot.timer);
          slot.resolve(msg);
        }
      });

      child.stderr.on('data', (d) => {
        const text = String(d).trim();
        if (text) log.warn('[powershell]', text);
      });

      child.on('exit', (code) => {
        for (const slot of this.pending.values()) {
          clearTimeout(slot.timer);
          slot.reject(new Error('PowerShell host exited'));
        }
        this.pending.clear();
        this.child = null;
        this.readyPromise = null;

        if (!ready) reject(new Error(`PowerShell host failed to start (exit ${code})`));
        else if (!this.stopping) log.warn('[powershell] host exited, will restart on next command');
      });

      child.on('error', (err) => {
        if (!ready) reject(err);
      });
    });

    return this.readyPromise;
  }

  async send(cmd, payload = {}) {
    await this.start();

    const id = this.nextId++;
    const line = JSON.stringify({ id, cmd, ...payload });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for "${cmd}"`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(line + '\n', (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  stop() {
    this.stopping = true;
    if (this.child) {
      try {
        this.child.stdin.end();
      } catch { /* already gone */ }
      this.child.kill();
    }
  }
}

/**
 * Runs the one-shot app scanner. Progress lines arrive on stderr.
 */
function runScan(iconDir, outFile, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath('scan-apps.ps1'),
        '-IconDir', iconDir,
        '-OutFile', outFile,
      ],
      { windowsHide: true }
    );

    let stderr = '';
    child.stderr.on('data', (d) => {
      const text = String(d);
      stderr += text;
      if (onProgress) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onProgress(line.trim());
        }
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scan failed (exit ${code}).\n${stderr.slice(-800)}`));
    });
  });
}

module.exports = { PowerShellHost, runScan };
