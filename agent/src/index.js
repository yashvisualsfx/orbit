'use strict';

/**
 * Orbit agent.
 *
 * Runs on the Windows PC and keeps one outbound WebSocket open to the relay, so
 * the PC is reachable from anywhere without port forwarding, a static IP, or
 * any router configuration.
 *
 * Control is authorised here, not at the relay: pairing checks the PIN and
 * mints a token signed with this machine's own secret, and every later command
 * is verified against that signature before it is allowed to run.
 *
 * Modes:
 *   (no arguments)  install if needed, start the background agent and open the
 *                   pairing page — what a double-click of the exe does
 *   --silent        be the agent; this is what the logon task runs
 *   --show          open the pairing page again
 *   --uninstall     remove the startup entry and stop the agent
 *   --scan-only     index installed apps and exit
 */

const WebSocket = require('ws');

const config = require('./config');
const install = require('./install');
const ui = require('./ui');
const { PACKAGED } = require('./paths');
const { log, LOG_FILE } = require('./log');
const { PowerShellHost } = require('./ps');
const { Commands } = require('./commands');

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 20000;
const PIN_ATTEMPT_LIMIT = 8;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

let cfg = null;
let host = null;
let commands = null;

let ws = null;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;
let stopping = false;
let pinFailures = { count: 0, until: 0 };

// ------------------------------------------------------------------ pairing
/**
 * The pairing link the PC hands to the browser. Device ID and PIN go in the
 * fragment, which browsers never send to a server, so the website can pair
 * itself without the PIN appearing in a request or a referrer header.
 */
function pairUrl() {
  const frag = new URLSearchParams({ d: cfg.deviceId, p: cfg.pin, n: cfg.name });
  return `${config.WEB_URL.replace(/\/$/, '')}/connect#${frag.toString()}`;
}

function tryPair(pairArgs) {
  const now = Date.now();
  if (pinFailures.count >= PIN_ATTEMPT_LIMIT && now < pinFailures.until) {
    const mins = Math.ceil((pinFailures.until - now) / 60000);
    throw new Error(`Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  const offered = String(pairArgs.pin || '').trim();

  // An invite code from an already-paired device counts as well, so a second
  // phone can be added from the first one instead of from the PC.
  if (offered !== cfg.pin && !commands.consumeInvite(offered)) {
    pinFailures.count += 1;
    pinFailures.until = now + PIN_LOCKOUT_MS;
    log.warn(`failed pairing attempt (${pinFailures.count})`);
    throw new Error('That PIN is not right');
  }

  pinFailures = { count: 0, until: 0 };
  const token = config.issueToken(cfg, String(pairArgs.label || 'Browser').slice(0, 40));
  log(`paired a new device (${pairArgs.label || 'Browser'})`);

  return { token, device: commands.deviceInfo() };
}

// ------------------------------------------------------------- connection
function connect() {
  if (stopping) return;

  const url = `${cfg.relay.replace(/\/$/, '')}/agent`;
  log(`connecting to ${url} ...`);

  ws = new WebSocket(url, { handshakeTimeout: 15000 });

  ws.on('open', () => {
    reconnectDelay = RECONNECT_MIN_MS;
    ws.send(JSON.stringify({
      t: 'agent.hello',
      deviceId: cfg.deviceId,
      deviceKey: cfg.deviceKey,
      name: cfg.name,
      platform: commands.deviceInfo().platform,
      version: commands.deviceInfo().agentVersion,
    }));
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Answer the relay's application-level heartbeat so it can tell a live
    // connection from a dead one through proxies that drop control frames.
    if (msg.t === 'ping') {
      send({ t: 'pong' });
      return;
    }

    if (msg.t === 'agent.ready') {
      log(`online as ${cfg.deviceId} · ${commands.appCount} apps`);
      sendIcons();
      return;
    }

    if (msg.t === 'agent.req') {
      await handleRequest(msg);
    }
  });

  ws.on('close', (code, reason) => {
    if (stopping) return;
    log(`disconnected (${code}${reason ? ' ' + reason : ''}), retrying in ${Math.round(reconnectDelay / 1000)}s`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    // 'close' always follows, so only surface the reason here.
    log.warn('connection error:', err.message);
  });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  // Back off gradually, with jitter so many agents do not retry in lockstep.
  reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2) * (0.85 + Math.random() * 0.3);
}

function sendIcons() {
  const pack = commands.iconPack();
  const ids = Object.keys(pack);
  if (!ids.length) return;

  // Chunked so a large library never trips the relay's payload limit.
  const CHUNK = 40;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = {};
    for (const id of ids.slice(i, i + CHUNK)) slice[id] = pack[id];
    send({ t: 'agent.icons', icons: slice });
  }
  log(`sent ${ids.length} icons`);
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ------------------------------------------------------------- requests
async function handleRequest(msg) {
  const reply = (ok, payload) =>
    send({ t: 'agent.reply', reqId: msg.reqId, ok, ...(ok ? { data: payload } : { error: payload }) });

  try {
    if (msg.cmd === 'pair') {
      reply(true, tryPair(msg.args || {}));
      return;
    }

    const client = config.verifyToken(cfg, msg.token);
    if (!client) {
      reply(false, 'Not paired with this PC');
      return;
    }

    reply(true, await commands.run(msg.cmd, msg.args, client));
  } catch (err) {
    reply(false, err.message || 'Something went wrong');
  }
}

// ------------------------------------------------------------------ output
/** Only printed when there is a console to print to: source runs and --show. */
function banner() {
  const line = '─'.repeat(46);
  const rows = [
    '',
    `  ╭${line}╮`,
    `  │  ORBIT${' '.repeat(line.length - 7)}│`,
    `  ├${line}┤`,
    `  │  Device ID   ${cfg.deviceId.padEnd(line.length - 14)}│`,
    `  │  Pairing PIN ${cfg.pin.padEnd(line.length - 14)}│`,
    `  ╰${line}╯`,
    '',
    `  ${pairUrl()}`,
    '',
  ];

  for (const row of rows) {
    try {
      process.stdout.write(row + '\n');
    } catch {
      /* no console in the packaged build */
    }
  }
}

// ------------------------------------------------------------------- agent
async function runAgent() {
  if (!config.claimSingleInstance()) {
    log('another copy of the agent is already running; exiting');
    return;
  }

  log(`agent starting (${PACKAGED ? 'packaged' : 'source'}) · relay ${cfg.relay}`);

  if (commands.appCount === 0 || has('--rescan')) {
    log('scanning installed apps (first run takes a few seconds)...');
    try {
      await commands.scan((line) => log(' ', line));
      log(`indexed ${commands.appCount} apps`);
    } catch (err) {
      log.error('app scan failed:', err.message);
    }
  }

  try {
    await host.start();
  } catch (err) {
    // Keep going rather than exit: the PC still appears online, and the worker
    // is retried on the next command. Vanishing from the website is worse.
    log.error('could not start the PowerShell worker:', err.message);
  }

  connect();
}

// ---------------------------------------------------------------- launcher
/**
 * What a double-click does: make sure Orbit is installed and running, then open
 * the pairing page. The page pairs itself from the fragment, so nothing has to
 * be typed — not here, and not on the phone that scans the QR code it shows.
 */
function runLauncher() {
  const state = install.ensureInstalled();

  if (!state.installed) {
    ui.message(
      `Orbit could not finish setting itself up.\n\n${state.error || 'Unknown error'}\n\nDetails: ${LOG_FILE}`
    );
    return;
  }

  if (state.autostart === null) {
    ui.message(
      'Orbit is running, but Windows would not let it register a startup entry, so '
      + 'it will not come back on its own after a restart.\n\n'
      + `Details: ${LOG_FILE}`
    );
  }

  if (!install.isRunning()) install.startBackground(state.exe);

  ui.openUrl(pairUrl());
}

// ------------------------------------------------------------------- start
async function main() {
  if (has('--uninstall')) {
    install.uninstall();
    ui.message(
      'Orbit has been removed from startup and is no longer running.\n\n'
      + 'Your Device ID and paired devices are kept, so installing it again '
      + 'reconnects everything without any codes.'
    );
    return;
  }

  cfg = config.load();
  host = new PowerShellHost();
  commands = new Commands(host, cfg);

  if (has('--scan-only')) {
    try {
      await commands.scan((line) => log(' ', line));
      log(`indexed ${commands.appCount} apps`);
    } catch (err) {
      log.error('scan failed:', err.message);
      process.exitCode = 1;
    }
    return;
  }

  if (has('--show')) {
    if (process.stdout.isTTY) banner();
    ui.openUrl(pairUrl());
    return;
  }

  // A packaged exe with no arguments has been double-clicked. From source, no
  // arguments means "run the agent here so I can watch it".
  if (PACKAGED && !has('--silent')) {
    runLauncher();
    return;
  }

  if (process.stdout.isTTY) banner();
  await runAgent();
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopping = true;
    clearTimeout(reconnectTimer);
    try {
      if (ws) ws.close();
    } catch {
      /* already closed */
    }
    if (host) host.stop();
    process.exit(0);
  });
}

// A crashed agent should keep the PC reachable rather than disappear silently.
process.on('uncaughtException', (err) => {
  log.error('unexpected error:', err.stack || err.message);
  if (!stopping && ws) scheduleReconnect();
});

main().catch((err) => {
  log.error('fatal:', err.stack || err.message);
  process.exitCode = 1;
});
