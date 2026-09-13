'use strict';

const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'agent.log');
const MAX_BYTES = 512 * 1024;

/*
 * The packaged agent runs as a GUI-subsystem process so nothing flashes on
 * screen at logon. That leaves it with no console at all: console.log writes
 * into a void and can even throw. Everything therefore goes to a rolling log
 * file, and the console write is a best-effort extra for development.
 */

let rolled = false;

function rollIfBig() {
  if (rolled) return;
  rolled = true;
  try {
    if (fs.statSync(LOG_FILE).size > MAX_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    }
  } catch {
    /* no log yet */
  }
}

function write(level, args) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const text = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.stack || a.message : JSON.stringify(a)))
    .join(' ');
  const line = `${stamp} ${level} ${text}\n`;

  try {
    rollIfBig();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* disk full or the folder vanished - never take the agent down for a log */
  }

  try {
    process.stdout.write(line);
  } catch {
    /* no console: packaged GUI build */
  }
}

const log = (...args) => write('   ', args);
log.warn = (...args) => write('WRN', args);
log.error = (...args) => write('ERR', args);
log.file = LOG_FILE;

module.exports = { log, LOG_FILE };
