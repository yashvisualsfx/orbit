'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { BIN_DIR, DATA_DIR, INSTALLED_EXE, PACKAGED, SELF_EXE } = require('./paths');
const { log } = require('./log');

const TASK_NAME = 'Orbit Agent';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const PID_FILE = path.join(DATA_DIR, 'agent.pid');
const SHORTCUT = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Orbit.lnk'
);

/** Runs a console tool without showing a window and reports success. */
function run(file, args) {
  const out = spawnSync(file, args, { windowsHide: true, encoding: 'utf8' });
  return { ok: out.status === 0, out: `${out.stdout || ''}${out.stderr || ''}`.trim() };
}

// ------------------------------------------------------------------ process
function runningPid() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
    if (!pid || pid === process.pid) return 0;
    process.kill(pid, 0); // existence check only
    return pid;
  } catch {
    return 0;
  }
}

function isRunning() {
  return runningPid() !== 0;
}

/** Stops a background agent and waits for its lock to clear. */
function stopRunning() {
  const pid = runningPid();
  if (!pid) return false;

  run('taskkill', ['/PID', String(pid), '/T', '/F']);
  // Synchronous wait: this only runs on the install path, with nothing to serve.
  for (let i = 0; i < 20 && runningPid(); i++) {
    spawnSync('cmd', ['/c', 'ping -n 2 127.0.0.1 >nul'], { windowsHide: true });
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* already gone */
  }
  return true;
}

/** Launches the agent detached, so it outlives the process that started it. */
function startBackground(exe = INSTALLED_EXE) {
  const child = spawn(exe, ['--silent'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

// --------------------------------------------------------------- autostart
function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/*
 * Registered from XML rather than with a plain `schtasks /SC ONLOGON` so the
 * task can carry the settings that actually matter for an always-on agent:
 * start even if the logon trigger was missed, never time out, never be stopped
 * for running on battery, and restart itself if it ever dies.
 */
function taskXml(exe) {
  const user = process.env.USERDOMAIN
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : os.userInfo().username;

  return [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    '  <RegistrationInfo>',
    '    <Author>Orbit</Author>',
    '    <Description>Keeps this PC reachable from the Orbit website.</Description>',
    '  </RegistrationInfo>',
    '  <Triggers>',
    '    <LogonTrigger>',
    '      <Enabled>true</Enabled>',
    `      <UserId>${xmlEscape(user)}</UserId>`,
    '      <Delay>PT5S</Delay>',
    '    </LogonTrigger>',
    '  </Triggers>',
    '  <Principals>',
    '    <Principal id="Author">',
    `      <UserId>${xmlEscape(user)}</UserId>`,
    '      <LogonType>InteractiveToken</LogonType>',
    '      <RunLevel>LeastPrivilege</RunLevel>',
    '    </Principal>',
    '  </Principals>',
    '  <Settings>',
    '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
    '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
    '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
    '    <AllowHardTerminate>true</AllowHardTerminate>',
    '    <StartWhenAvailable>true</StartWhenAvailable>',
    '    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
    '    <IdleSettings>',
    '      <StopOnIdleEnd>false</StopOnIdleEnd>',
    '      <RestartOnIdle>false</RestartOnIdle>',
    '    </IdleSettings>',
    '    <AllowStartOnDemand>true</AllowStartOnDemand>',
    '    <Enabled>true</Enabled>',
    '    <Hidden>false</Hidden>',
    '    <RunOnlyIfIdle>false</RunOnlyIfIdle>',
    '    <WakeToRun>false</WakeToRun>',
    '    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
    '    <Priority>7</Priority>',
    '    <RestartOnFailure>',
    '      <Interval>PT1M</Interval>',
    '      <Count>99</Count>',
    '    </RestartOnFailure>',
    '  </Settings>',
    '  <Actions Context="Author">',
    '    <Exec>',
    `      <Command>${xmlEscape(exe)}</Command>`,
    '      <Arguments>--silent</Arguments>',
    '    </Exec>',
    '  </Actions>',
    '</Task>',
  ].join('\r\n');
}

function hasTask() {
  return run('schtasks', ['/Query', '/TN', TASK_NAME]).ok;
}

/**
 * Makes the agent start with Windows. Three routes, tried in order, because a
 * locked-down machine can refuse the first two: a scheduled task from XML, a
 * plain logon task, then the per-user Run key.
 */
function enableAutostart(exe) {
  run('schtasks', ['/End', '/TN', TASK_NAME]);
  run('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']);

  const xmlFile = path.join(os.tmpdir(), `orbit-task-${process.pid}.xml`);
  try {
    // schtasks only reads UTF-16 task definitions.
    fs.writeFileSync(xmlFile, Buffer.from('\ufeff' + taskXml(exe), 'utf16le'));
    const xml = run('schtasks', ['/Create', '/TN', TASK_NAME, '/XML', xmlFile, '/F']);
    if (xml.ok) return 'task';
    log.warn('XML task registration failed:', xml.out);
  } catch (err) {
    log.warn('could not write the task definition:', err.message);
  } finally {
    try {
      fs.unlinkSync(xmlFile);
    } catch {
      /* already gone */
    }
  }

  const simple = run('schtasks', [
    '/Create', '/TN', TASK_NAME,
    '/TR', `"${exe}" --silent`,
    '/SC', 'ONLOGON', '/RL', 'LIMITED', '/F',
  ]);
  if (simple.ok) return 'task';
  log.warn('logon task failed:', simple.out);

  const reg = run('reg', [
    'add', RUN_KEY, '/v', 'Orbit', '/t', 'REG_SZ',
    '/d', `"${exe}" --silent`, '/f',
  ]);
  if (reg.ok) return 'run-key';

  log.error('no autostart route available:', reg.out);
  return null;
}

function disableAutostart() {
  run('schtasks', ['/End', '/TN', TASK_NAME]);
  run('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']);
  run('reg', ['delete', RUN_KEY, '/v', 'Orbit', '/f']);

  if (process.env.APPDATA) {
    try {
      // Left behind by the older .bat installer.
      fs.unlinkSync(path.join(
        process.env.APPDATA,
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Orbit.vbs'
      ));
    } catch {
      /* never existed */
    }
  }
}

function psString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createShortcut(exe) {
  const ps = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${psString(SHORTCUT)})`,
    `$s.TargetPath = ${psString(exe)}`,
    `$s.WorkingDirectory = ${psString(path.dirname(exe))}`,
    `$s.Description = ${psString('Open Orbit')}`,
    '$s.Save()',
  ].join('; ');

  run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
}

// ----------------------------------------------------------------- install
function sameFile(a, b) {
  try {
    if (fs.statSync(a).size !== fs.statSync(b).size) return false;
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

/**
 * Copies the exe into place and registers it for startup. Safe to run on every
 * launch: it only does work when something is missing or out of date.
 */
function ensureInstalled() {
  if (!PACKAGED) return { packaged: false, installed: false, exe: SELF_EXE };

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const inPlace = path.resolve(SELF_EXE).toLowerCase() === INSTALLED_EXE.toLowerCase();
  let copied = false;

  if (!inPlace && !sameFile(SELF_EXE, INSTALLED_EXE)) {
    // Never overwrite an executable while the installed agent is running.
    // Windows locks running .exe files, which can otherwise produce EBUSY.
    // Reuse the live installation now; the new binary can be installed after
    // Orbit has been stopped, rather than interrupting the active connection.
    if (isRunning()) {
      log.warn('installed Orbit is already running; deferring executable update to avoid EBUSY');
    } else {
      try {
        fs.copyFileSync(SELF_EXE, INSTALLED_EXE);
        copied = true;
      } catch (err) {
        // If another Orbit process won the race and locked the destination,
        // keep using the existing installation when it is still available.
        if (err.code === 'EBUSY' && fs.existsSync(INSTALLED_EXE) && isRunning()) {
          log.warn('Orbit became active during update; keeping the existing installation');
        } else {
          log.error('could not copy Orbit into place:', err.message);
          return { packaged: true, installed: false, exe: SELF_EXE, error: err.message };
        }
      }
    }
  }

  const autostart = copied || !hasTask() ? enableAutostart(INSTALLED_EXE) : 'task';
  createShortcut(INSTALLED_EXE);

  return { packaged: true, installed: true, copied, autostart, exe: INSTALLED_EXE };
}

function uninstall() {
  disableAutostart();
  stopRunning();
  try {
    fs.unlinkSync(SHORTCUT);
  } catch {
    /* never created */
  }
}

module.exports = {
  TASK_NAME,
  disableAutostart,
  enableAutostart,
  ensureInstalled,
  hasTask,
  isRunning,
  startBackground,
  stopRunning,
  uninstall,
};
