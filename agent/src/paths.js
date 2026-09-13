'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/*
 * Where everything lives, and how the PowerShell scripts are found in both the
 * "node src/index.js" and the packaged-exe case.
 *
 * Identity is kept outside the install folder so it survives moving, updating
 * or reinstalling the agent.
 */

const LOCAL_APPDATA =
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

const DATA_DIR = path.join(LOCAL_APPDATA, 'Orbit');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ICON_DIR = path.join(DATA_DIR, 'icons');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');

// The exe installs itself here so deleting the download folder cannot break
// startup, and so the logon task always points at a stable path.
const BIN_DIR = path.join(DATA_DIR, 'bin');
const EXE_NAME = 'Orbit.exe';
const INSTALLED_EXE = path.join(BIN_DIR, EXE_NAME);

// Unpacked copies of the .ps1 workers, for the packaged build.
const SCRIPT_CACHE = path.join(DATA_DIR, 'scripts');

/** True when running from a single-file build rather than from source. */
const PACKAGED = Boolean(process.pkg) || Boolean(process.versions.pkg);

/** Path of the running executable (packaged) or of node itself (source). */
const SELF_EXE = process.execPath;

/** Relay and website URLs stamped in at build time. */
function buildConfig() {
  try {
    return require('./build.json');
  } catch {
    return {};
  }
}

const BUILD = buildConfig();

/**
 * Absolute path to a PowerShell worker that `powershell.exe -File` can open.
 *
 * Inside a packaged build the scripts live in a virtual filesystem that only
 * this process can read, so they are written out to the data folder first. The
 * copy is refreshed when the contents differ, which keeps it correct across
 * agent updates without rewriting it on every start.
 */
function scriptPath(name) {
  const source = path.join(__dirname, '..', 'scripts', name);
  if (!PACKAGED) return source;

  const target = path.join(SCRIPT_CACHE, name);
  const wanted = fs.readFileSync(source);

  try {
    if (fs.readFileSync(target).equals(wanted)) return target;
  } catch {
    /* not extracted yet */
  }

  fs.mkdirSync(SCRIPT_CACHE, { recursive: true });
  fs.writeFileSync(target, wanted);
  return target;
}

module.exports = {
  APPS_FILE,
  BIN_DIR,
  BUILD,
  CONFIG_FILE,
  DATA_DIR,
  EXE_NAME,
  ICON_DIR,
  INSTALLED_EXE,
  PACKAGED,
  SCRIPT_CACHE,
  SELF_EXE,
  scriptPath,
};
