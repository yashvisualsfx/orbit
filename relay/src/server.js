'use strict';

/**
 * Orbit relay.
 *
 * A dumb, stateless pipe between browsers and the agents running on people's
 * PCs. Agents hold an outbound WebSocket open, so nobody has to forward a port
 * or own a static IP.
 *
 * The relay deliberately holds no authority: it never issues the token a
 * browser uses to control a PC. Pairing requests are forwarded to the agent,
 * the agent checks the PIN and mints the token itself, and the agent verifies
 * that token on every command. A compromised relay can disrupt traffic but
 * cannot grant anyone control of a machine.
 */

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const HEARTBEAT_MS = 25000;
const REQUEST_TTL_MS = 30000;
const ICON_CACHE_MAX_DEVICES = 500;

/** deviceId -> { socket, info, icons: Map<appId, Buffer>, clients: Set<ws> } */
const devices = new Map();

/** Recently used device ids, newest last, for trimming the icon cache. */
const iconLru = [];

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function touchIcons(deviceId) {
  const at = iconLru.indexOf(deviceId);
  if (at !== -1) iconLru.splice(at, 1);
  iconLru.push(deviceId);

  while (iconLru.length > ICON_CACHE_MAX_DEVICES) {
    const evicted = iconLru.shift();
    const dev = devices.get(evicted);
    if (dev) dev.icons = new Map();
  }
}

// --------------------------------------------------------------------- http
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, devices: devices.size, uptime: process.uptime() }));
    return;
  }

  // Icons are pushed by the agent once per connection and served over plain
  // HTTP so the browser can use <img src> and its own cache.
  const iconMatch = url.pathname.match(/^\/icon\/([A-Za-z0-9-]+)\/([a-f0-9]+)\.png$/);
  if (iconMatch) {
    const dev = devices.get(iconMatch[1]);
    const buf = dev && dev.icons.get(iconMatch[2]);
    if (!buf) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'image/png',
      'content-length': buf.length,
      'cache-control': 'public, max-age=604800, immutable',
    });
    res.end(buf);
    return;
  }

  // Lets the web app show "this PC is offline" without opening a socket.
  const statusMatch = url.pathname.match(/^\/status\/([A-Za-z0-9-]+)$/);
  if (statusMatch) {
    const dev = devices.get(statusMatch[1]);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      online: !!dev,
      name: dev ? dev.info.name : null,
      platform: dev ? dev.info.platform : null,
    }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

// ---------------------------------------------------------------- websocket
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.pathname === '/agent' ? 'agent' : url.pathname === '/client' ? 'client' : null;

  if (!role) {
    ws.close(4004, 'unknown endpoint');
    return;
  }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.role = role;
  ws.deviceId = null;
  /** For clients: reqId -> true, so replies can be matched back. */
  ws.pending = new Map();

  ws.on('message', (raw) => {
    // Any inbound frame proves the peer is alive. Relying on protocol-level
    // pong alone is not enough: some edge proxies do not forward WebSocket
    // control frames, which would make the relay kill healthy connections.
    ws.isAlive = true;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.t === 'pong') return;
    if (msg.t === 'ping') {
      send(ws, { t: 'pong' });
      return;
    }

    if (role === 'agent') handleAgentMessage(ws, msg);
    else handleClientMessage(ws, msg);
  });

  ws.on('close', () => {
    if (role === 'agent' && ws.deviceId) {
      const dev = devices.get(ws.deviceId);
      if (dev && dev.socket === ws) {
        for (const client of dev.clients) send(client, { t: 'device.offline' });
        devices.delete(ws.deviceId);
        log('agent offline', ws.deviceId);
      }
    } else if (role === 'client' && ws.deviceId) {
      const dev = devices.get(ws.deviceId);
      if (dev) dev.clients.delete(ws);
    }
  });
});

// ------------------------------------------------------------------- agents
function handleAgentMessage(ws, msg) {
  switch (msg.t) {
    case 'agent.hello': {
      const { deviceId, deviceKey, name, platform, version } = msg;
      if (!deviceId || !deviceKey) {
        ws.close(4001, 'missing identity');
        return;
      }

      // deviceId must be derivable from the key, so an agent cannot claim an
      // id that belongs to somebody else's machine.
      const expected = deviceIdFromKey(deviceKey);
      if (expected !== deviceId) {
        log('rejected agent, id/key mismatch', deviceId);
        ws.close(4003, 'identity mismatch');
        return;
      }

      // A reconnecting agent replaces its previous socket (common after the
      // PC sleeps and the old connection is still half-open).
      const existing = devices.get(deviceId);
      if (existing && existing.socket !== ws) {
        try { existing.socket.close(4000, 'replaced'); } catch { /* already gone */ }
      }

      ws.deviceId = deviceId;
      devices.set(deviceId, {
        socket: ws,
        info: { name, platform, version },
        icons: existing ? existing.icons : new Map(),
        clients: existing ? existing.clients : new Set(),
      });
      touchIcons(deviceId);

      send(ws, { t: 'agent.ready' });
      log('agent online', deviceId, `(${name})`);

      // Tell any browser that was waiting on this PC that it came back.
      for (const client of devices.get(deviceId).clients) {
        send(client, { t: 'device.online', device: { name, platform } });
      }
      return;
    }

    case 'agent.icons': {
      const dev = devices.get(ws.deviceId);
      if (!dev) return;
      for (const [appId, b64] of Object.entries(msg.icons || {})) {
        dev.icons.set(appId, Buffer.from(b64, 'base64'));
      }
      touchIcons(ws.deviceId);
      log('icons cached', ws.deviceId, dev.icons.size);
      return;
    }

    case 'agent.reply': {
      const dev = devices.get(ws.deviceId);
      if (!dev) return;
      for (const client of dev.clients) {
        if (client.pending.has(msg.reqId)) {
          client.pending.delete(msg.reqId);
          send(client, { t: 'reply', reqId: msg.reqId, ok: msg.ok, data: msg.data, error: msg.error });
          return;
        }
      }
      return;
    }

    case 'agent.event': {
      const dev = devices.get(ws.deviceId);
      if (!dev) return;
      for (const client of dev.clients) {
        send(client, { t: 'event', event: msg.event, data: msg.data });
      }
      return;
    }
  }
}

function deviceIdFromKey(deviceKey) {
  const hash = crypto.createHash('sha256').update(String(deviceKey)).digest('hex');
  // Grouped for readability when someone types it in: ORB-4F2A-91C7
  return `ORB-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`;
}

// ------------------------------------------------------------------ clients
function handleClientMessage(ws, msg) {
  switch (msg.t) {
    case 'client.attach': {
      const deviceId = String(msg.deviceId || '').toUpperCase();
      const dev = devices.get(deviceId);

      ws.deviceId = deviceId;
      if (!dev) {
        send(ws, { t: 'device.offline' });
        return;
      }

      dev.clients.add(ws);
      send(ws, { t: 'device.online', device: dev.info });
      return;
    }

    case 'client.req': {
      const dev = devices.get(ws.deviceId);
      if (!dev) {
        send(ws, { t: 'reply', reqId: msg.reqId, ok: false, error: 'This PC is offline' });
        return;
      }

      ws.pending.set(msg.reqId, true);
      setTimeout(() => {
        if (ws.pending.delete(msg.reqId)) {
          send(ws, { t: 'reply', reqId: msg.reqId, ok: false, error: 'The PC did not respond' });
        }
      }, REQUEST_TTL_MS);

      // The token travels through untouched; only the agent can validate it.
      send(dev.socket, {
        t: 'agent.req',
        reqId: msg.reqId,
        cmd: msg.cmd,
        args: msg.args || {},
        token: msg.token || null,
      });
      return;
    }
  }
}

// ---------------------------------------------------------------- liveness
// Heartbeats are sent as ordinary JSON messages rather than WebSocket ping
// frames, because platform proxies may drop control frames without closing the
// connection. Real data frames also keep proxy idle timers from firing.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    send(ws, { t: 'ping' });
    try { ws.ping(); } catch { /* belt and braces; ignore if closing */ }
  }
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => log(`Orbit relay listening on :${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  });
}
