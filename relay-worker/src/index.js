/**
 * Orbit relay, on Cloudflare Workers.
 *
 * Same job as the old Node relay: a dumb pipe between browsers and the agents
 * running on people's PCs, so nobody has to forward a port or own a static IP.
 * It still holds no authority - pairing is forwarded to the agent, which checks
 * the PIN, mints the token and verifies that token on every later command.
 *
 * The shape is different because Workers have no long-lived process to hold a
 * socket table in. Each PC gets its own Durable Object, addressed by device id,
 * which owns that machine's agent socket, the browsers attached to it and its
 * cached icons. Sockets are accepted with the hibernation API, so an idle PC
 * keeps its connection open while its object is evicted from memory and billed
 * for nothing.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
};

const ICON_PATH = /^\/icon\/([A-Za-z0-9-]+)\/([a-f0-9]+)\.png$/;
const STATUS_PATH = /^\/status\/([A-Za-z0-9-]+)$/;

/** Largest icon we will store. Anything bigger is a bug in the scanner. */
const MAX_ICON_BYTES = 120 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

/** Device ids are case-insensitive on the wire and uppercase everywhere here. */
function normalizeId(raw) {
  const id = String(raw || '').trim().toUpperCase();
  return /^[A-Z0-9-]{3,40}$/.test(id) ? id : '';
}

function deviceStub(env, deviceId) {
  return env.DEVICE.get(env.DEVICE.idFromName(deviceId));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/health') {
      // Per-PC state lives in per-PC objects, so there is no global device
      // count to report here. /status/<device id> answers that question.
      return json({ ok: true, relay: 'cloudflare-workers' });
    }

    // Both socket endpoints carry the device id in the query string. A Worker
    // cannot hand an accepted socket to a Durable Object later, so the routing
    // decision has to be made from the URL, before the upgrade.
    if (url.pathname === '/agent' || url.pathname === '/client') {
      if (request.headers.get('upgrade') !== 'websocket') {
        return new Response('expected a websocket upgrade', { status: 426, headers: CORS });
      }

      const deviceId = normalizeId(url.searchParams.get('d'));
      if (!deviceId) {
        return new Response('missing device id', { status: 400, headers: CORS });
      }

      return deviceStub(env, deviceId).fetch(request);
    }

    const icon = url.pathname.match(ICON_PATH);
    if (icon) return deviceStub(env, normalizeId(icon[1])).fetch(request);

    const status = url.pathname.match(STATUS_PATH);
    if (status) return deviceStub(env, normalizeId(status[1])).fetch(request);

    return json({ error: 'not found' }, 404);
  },
};

export class DeviceRelay {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    /*
     * Heartbeats are answered by the runtime itself: a hibernating object is
     * not woken to reply, and the exchange still keeps every proxy on the path
     * from treating the connection as idle. Both peers send this exact frame.
     */
    state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(
        JSON.stringify({ t: 'ping' }),
        JSON.stringify({ t: 'pong' })
      )
    );
  }

  // ------------------------------------------------------------------ routing
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/agent' || url.pathname === '/client') {
      return this.accept(url.pathname === '/agent' ? 'agent' : 'client');
    }

    const icon = url.pathname.match(ICON_PATH);
    if (icon) return this.serveIcon(icon[2]);

    const status = url.pathname.match(STATUS_PATH);
    if (status) {
      const info = (await this.state.storage.get('info')) || null;
      return json({
        online: this.agent() !== null,
        name: info ? info.name : null,
        platform: info ? info.platform : null,
      });
    }

    return json({ error: 'not found' }, 404);
  }

  accept(role) {
    const { 0: browserSide, 1: relaySide } = new WebSocketPair();

    this.state.acceptWebSocket(relaySide, [role]);
    // Survives hibernation, which is the only per-socket memory this object has.
    relaySide.serializeAttachment({ role, id: crypto.randomUUID().slice(0, 8) });

    return new Response(null, { status: 101, webSocket: browserSide });
  }

  async serveIcon(appId) {
    const bytes = await this.state.storage.get(`icon:${appId}`);
    if (!bytes) return new Response(null, { status: 404, headers: CORS });

    return new Response(bytes, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=604800, immutable',
        ...CORS,
      },
    });
  }

  // ------------------------------------------------------------------ sockets
  /** The live agent socket, or null. `except` skips a socket that is closing. */
  agent(except = null) {
    for (const ws of this.state.getWebSockets('agent')) {
      if (ws !== except) return ws;
    }
    return null;
  }

  clients() {
    return this.state.getWebSockets('client');
  }

  broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const ws of this.clients()) {
      try {
        ws.send(payload);
      } catch {
        /* closing; its close handler will clean up */
      }
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return; // the protocol is JSON text only

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.t === 'pong') return;
    if (msg.t === 'ping') {
      // Only reached if a peer's frame differs from the auto-response pair.
      send(ws, { t: 'pong' });
      return;
    }

    const seat = ws.deserializeAttachment() || {};
    if (seat.role === 'agent') await this.onAgent(ws, msg);
    else await this.onClient(ws, msg, seat);
  }

  async webSocketClose(ws) {
    const seat = ws.deserializeAttachment() || {};
    if (seat.role !== 'agent') return;

    // Another socket only exists when a reconnecting agent has already taken
    // over, in which case the PC never actually went offline.
    if (this.agent(ws)) return;

    await this.state.storage.delete('info');
    this.broadcast({ t: 'device.offline' });
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  // ------------------------------------------------------------------- agents
  async onAgent(ws, msg) {
    switch (msg.t) {
      case 'agent.hello': {
        const { deviceId, deviceKey, name, platform, version, iconSig } = msg;
        if (!deviceId || !deviceKey) {
          ws.close(4001, 'missing identity');
          return;
        }

        // The id must be derivable from the key, so an agent cannot claim an id
        // that belongs to someone else's machine, and it must match the object
        // it connected to.
        const expected = await deviceIdFromKey(deviceKey);
        if (expected !== String(deviceId).toUpperCase() || expected !== this.state.id.name) {
          ws.close(4003, 'identity mismatch');
          return;
        }

        // A reconnecting agent replaces its previous socket, which is common
        // after the PC sleeps and the old connection is still half-open.
        const previous = this.agent(ws);
        if (previous) {
          try {
            previous.close(4000, 'replaced');
          } catch {
            /* already gone */
          }
        }

        const info = { name, platform, version };
        await this.state.storage.put('info', info);

        // Icons are only worth re-sending when the library actually changed;
        // a flapping connection would otherwise rewrite every icon each time.
        const stored = await this.state.storage.get('iconSig');
        const needIcons = !iconSig || !stored || stored !== iconSig;

        send(ws, { t: 'agent.ready', needIcons });
        this.broadcast({ t: 'device.online', device: info });
        return;
      }

      case 'agent.icons': {
        // A new pack replaces the old one: ids disappear when apps are removed.
        if (msg.first) {
          const stale = await this.state.storage.list({ prefix: 'icon:' });
          if (stale.size) await this.state.storage.delete([...stale.keys()]);
          await this.state.storage.delete('iconSig');
        }

        const batch = {};
        for (const [appId, b64] of Object.entries(msg.icons || {})) {
          const bytes = decodeBase64(b64);
          if (bytes && bytes.byteLength <= MAX_ICON_BYTES) batch[`icon:${appId}`] = bytes;
        }
        if (Object.keys(batch).length) await this.state.storage.put(batch);

        // The signature is only recorded once the whole pack has landed, so an
        // interrupted transfer is re-sent rather than assumed complete.
        if (msg.done && msg.sig) await this.state.storage.put('iconSig', msg.sig);
        return;
      }

      case 'agent.reply': {
        // reqIds are rewritten on the way out as "<socket>:<id>", so a reply
        // can be routed back without the relay tracking anything in memory.
        const [seatId, reqId] = String(msg.reqId || '').split(':');
        for (const client of this.clients()) {
          const seat = client.deserializeAttachment() || {};
          if (seat.id !== seatId) continue;
          send(client, {
            t: 'reply',
            reqId: Number(reqId),
            ok: msg.ok,
            data: msg.data,
            error: msg.error,
          });
          return;
        }
        return;
      }

      case 'agent.event': {
        this.broadcast({ t: 'event', event: msg.event, data: msg.data });
        return;
      }
    }
  }

  // ------------------------------------------------------------------ clients
  async onClient(ws, msg, seat) {
    switch (msg.t) {
      case 'client.attach': {
        const info = (await this.state.storage.get('info')) || null;
        if (!this.agent() || !info) {
          send(ws, { t: 'device.offline' });
          return;
        }
        send(ws, { t: 'device.online', device: info });
        return;
      }

      case 'client.req': {
        const agent = this.agent();
        if (!agent) {
          send(ws, { t: 'reply', reqId: msg.reqId, ok: false, error: 'This PC is offline' });
          return;
        }

        // The token travels through untouched; only the agent can validate it.
        send(agent, {
          t: 'agent.req',
          reqId: `${seat.id}:${msg.reqId}`,
          cmd: msg.cmd,
          args: msg.args || {},
          token: msg.token || null,
        });
        return;
      }
    }
  }
}

function send(ws, msg) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    /* socket is closing; nothing to do */
  }
}

/** ORB-4F2A-91C7, from the SHA-256 of the agent's private device key. */
async function deviceIdFromKey(deviceKey) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(deviceKey))
  );
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `ORB-${hex.slice(0, 4).toUpperCase()}-${hex.slice(4, 8).toUpperCase()}`;
}

function decodeBase64(value) {
  try {
    const binary = atob(String(value));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
