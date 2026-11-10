"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export const RELAY =
  process.env.NEXT_PUBLIC_ORBIT_RELAY ?? "ws://127.0.0.1:8080";

/** The relay's HTTP origin, derived from its WebSocket URL. */
export const RELAY_HTTP = RELAY.replace(/^ws/, "http");

const HEARTBEAT_MS = 25000;
const SILENCE_LIMIT_MS = 70000;

/**
 * The socket URL for one PC.
 *
 * The device id is in the query string, not only in the attach message that
 * follows, because the relay routes the connection to the object that owns that
 * PC before it can read anything the browser sends.
 */
function clientUrl(deviceId: string) {
  return `${RELAY}/client?d=${encodeURIComponent(deviceId)}`;
}

const STORAGE_DEVICE = "orbit.deviceId";
const STORAGE_TOKEN = "orbit.token";
const PAIR_COOKIE = "orbit.pair";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppEntry = {
  id: string;
  name: string;
  kind: "win32" | "uwp";
  method: "shell" | "aumid";
  target: string;
  exe?: string;
  icon?: string | null;
};

export type WindowEntry = {
  pid: number;
  hwnd: number;
  name: string;
  title: string;
  path: string | null;
  mem: number;
};

export type DeviceInfo = {
  id?: string;
  name: string;
  platform: string;
  appCount?: number;
  agentVersion?: string;
};

export type Status =
  | "connecting"
  | "online"
  | "offline"
  | "unpaired"
  | "error";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/*
 * Pairing lives in localStorage, which React can only read after hydration.
 * Exposing it through useSyncExternalStore keeps the read out of an effect and
 * makes a change in another tab propagate here automatically.
 */
export type Pairing = { deviceId: string; token: string };

const EMPTY_PAIRING: Pairing = { deviceId: "", token: "" };

let cachedPairing: Pairing = EMPTY_PAIRING;
let cachedKey = "";
const pairingListeners = new Set<() => void>();

/*
 * The pairing is written to localStorage *and* to a cookie, and read back from
 * whichever still has it. This is not belt-and-braces for its own sake: Safari
 * evicts a site's localStorage after seven days without a visit, which is
 * exactly the interval that makes someone think Orbit "forgot" their PC. The
 * cookie survives that, and a site installed to the home screen keeps both.
 */
function readCookiePairing(): Pairing {
  if (typeof document === "undefined") return EMPTY_PAIRING;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PAIR_COOKIE}=([^;]*)`),
  );
  if (!match) return EMPTY_PAIRING;

  const parsed = parseResumeKey(decodeURIComponent(match[1]));
  return parsed ?? EMPTY_PAIRING;
}

function writeCookiePairing(pairing: Pairing | null) {
  if (typeof document === "undefined") return;

  const secure = location.protocol === "https:" ? "; secure" : "";
  if (!pairing) {
    document.cookie = `${PAIR_COOKIE}=; max-age=0; path=/; samesite=lax${secure}`;
    return;
  }

  const value = encodeURIComponent(resumeKey(pairing));
  document.cookie =
    `${PAIR_COOKIE}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax${secure}`;
}

function localValue(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return ""; // private mode, or storage blocked entirely
  }
}

/** Must return a stable reference while the stored values are unchanged. */
function pairingSnapshot(): Pairing {
  let deviceId = localValue(STORAGE_DEVICE);
  let token = localValue(STORAGE_TOKEN);

  if (!deviceId || !token) {
    const fromCookie = readCookiePairing();
    if (fromCookie.deviceId && fromCookie.token) {
      deviceId = fromCookie.deviceId;
      token = fromCookie.token;
    }
  }

  const key = `${deviceId}::${token}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedPairing = { deviceId, token };
  }
  return cachedPairing;
}

function serverPairingSnapshot(): Pairing {
  return EMPTY_PAIRING;
}

function subscribePairing(onChange: () => void) {
  pairingListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    pairingListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notifyPairingChanged() {
  for (const listener of pairingListeners) listener();
}

export function usePairing(): Pairing {
  return useSyncExternalStore(subscribePairing, pairingSnapshot, serverPairingSnapshot);
}

/**
 * Authoritative read for use inside effects. usePairing reports the empty server
 * snapshot on the hydration pass, so a redirect decision must not be based on it.
 */
export function readStored(): Pairing {
  if (typeof window === "undefined") return EMPTY_PAIRING;
  return pairingSnapshot();
}

export function storePairing(deviceId: string, token: string) {
  try {
    localStorage.setItem(STORAGE_DEVICE, deviceId);
    localStorage.setItem(STORAGE_TOKEN, token);
  } catch {
    /* the cookie below is enough to stay paired */
  }
  writeCookiePairing({ deviceId, token });
  requestDurableStorage();
  notifyPairingChanged();
}

export function clearPairing() {
  try {
    localStorage.removeItem(STORAGE_DEVICE);
    localStorage.removeItem(STORAGE_TOKEN);
  } catch {
    /* nothing stored there */
  }
  writeCookiePairing(null);
  notifyPairingChanged();
}

/**
 * Copies a pairing recovered from the cookie back into localStorage, so the two
 * stores heal each other instead of the site slowly losing the pairing.
 */
export function reinforcePairing() {
  const { deviceId, token } = readStored();
  if (!deviceId || !token) return;
  storePairing(deviceId, token);
}

/**
 * Asks the browser not to evict this site's storage under pressure. Granted
 * without a prompt once the site is installed or frequently used; a refusal
 * costs nothing, since the cookie is the backstop.
 */
function requestDurableStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

// --------------------------------------------------------------- resume keys
/*
 * A resume key is the whole pairing in one opaque string: the device id and the
 * token the PC signed. It travels in a URL fragment, which browsers never send
 * to a server, so a link or QR code can move a pairing to another device without
 * the PIN being typed again — and without the token touching the network.
 *
 * It is a secret. Anyone holding it controls that PC until the pairing is
 * revoked, which is why the UI that shows one says so.
 */
export function resumeKey({ deviceId, token }: Pairing): string {
  const packed = `${deviceId}|${token}`;
  return btoa(packed).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function parseResumeKey(raw: string): Pairing | null {
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const [deviceId, token] = atob(padded).split("|");
    if (!deviceId || !token) return null;
    return { deviceId, token };
  } catch {
    return null;
  }
}

/** The link that joins another device to this PC with no code to type. */
export function pairingLink(pairing: Pairing): string {
  return `${location.origin}/connect#k=${resumeKey(pairing)}`;
}

export type HashInvite =
  | { kind: "pin"; deviceId: string; pin: string; name: string }
  | { kind: "resume"; deviceId: string; token: string };

/**
 * Reads an invitation out of the URL fragment. Two shapes arrive here: the one
 * the agent opens on the PC (device id + PIN) and the one a QR code carries
 * between devices (a resume key).
 */
export function readInviteFromHash(): HashInvite | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);

  const key = params.get("k");
  if (key) {
    const parsed = parseResumeKey(key);
    if (parsed) return { kind: "resume", ...parsed };
  }

  const deviceId = params.get("d");
  const pin = params.get("p");
  if (deviceId && pin) {
    return {
      kind: "pin",
      deviceId: deviceId.toUpperCase(),
      pin,
      name: params.get("n") ?? "",
    };
  }

  return null;
}

/** Drops the fragment without adding a history entry or reloading. */
export function clearHash() {
  if (typeof window === "undefined" || !window.location.hash) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Holds one WebSocket to the relay and matches replies back to their calls.
 *
 * The relay only routes; the token in every call is checked by the agent on the
 * PC itself, so a paired browser is authorised by the machine it controls.
 */
export function useOrbit(deviceId: string, token: string) {
  const [socketStatus, setSocketStatus] = useState<Status>("connecting");
  const [device, setDevice] = useState<DeviceInfo | null>(null);

  // Derived, so the hook never has to write state just to report "no PC yet".
  const status: Status = deviceId ? socketStatus : "unpaired";

  const wsRef = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const retry = useRef(1000);
  const closed = useRef(false);

  useEffect(() => {
    if (!deviceId) return;

    closed.current = false;
    const inflight = pending.current;
    let timer: ReturnType<typeof setTimeout>;
    let beat: ReturnType<typeof setInterval>;
    let heard = Date.now();

    const open = () => {
      if (closed.current) return;

      const ws = new WebSocket(clientUrl(deviceId));
      wsRef.current = ws;

      ws.onopen = () => {
        retry.current = 1000;
        ws.send(JSON.stringify({ t: "client.attach", deviceId }));

        /*
         * The browser is the side that heartbeats. It keeps the socket alive
         * through proxy idle timers, and it notices a connection that died
         * without a close frame - which is what a phone coming out of a pocket
         * usually has. The relay answers this exact frame at the edge.
         */
        heard = Date.now();
        clearInterval(beat);
        beat = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (Date.now() - heard > SILENCE_LIMIT_MS) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ t: "ping" }));
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (ev) => {
        heard = Date.now();

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }

        if (msg.t === "pong") return;

        // Older relays heartbeat the other way around.
        if (msg.t === "ping") {
          ws.send(JSON.stringify({ t: "pong" }));
          return;
        }

        if (msg.t === "device.online") {
          setDevice(msg.device as DeviceInfo);
          setSocketStatus("online");
          return;
        }

        if (msg.t === "device.offline") {
          setSocketStatus("offline");
          return;
        }

        if (msg.t === "reply") {
          const slot = inflight.get(msg.reqId as number);
          if (!slot) return;
          inflight.delete(msg.reqId as number);
          clearTimeout(slot.timer);
          if (msg.ok) slot.resolve(msg.data);
          else slot.reject(new Error((msg.error as string) || "Request failed"));
        }
      };

      ws.onclose = () => {
        clearInterval(beat);
        if (closed.current) return;
        setSocketStatus("connecting");
        timer = setTimeout(open, retry.current);
        retry.current = Math.min(15000, retry.current * 2);
      };

      ws.onerror = () => {
        // onclose always follows and handles the retry.
      };
    };

    open();

    /*
     * A phone that has been in a pocket comes back with a dead socket and, left
     * alone, would sit out the remaining backoff before noticing. Waking on
     * visibility, network return and back-navigation restore makes the PC appear
     * online as fast as the handshake allows.
     */
    const wake = () => {
      if (closed.current) return;
      if (document.visibilityState !== "visible") return;

      const live = wsRef.current;
      if (live && (live.readyState === WebSocket.OPEN || live.readyState === WebSocket.CONNECTING)) {
        return;
      }

      clearTimeout(timer);
      retry.current = 1000;
      open();
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);

    return () => {
      closed.current = true;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      clearTimeout(timer);
      clearInterval(beat);
      wsRef.current?.close();
      for (const slot of inflight.values()) {
        clearTimeout(slot.timer);
        slot.reject(new Error("Disconnected"));
      }
      inflight.clear();
    };
  }, [deviceId]);

  const call = useCallback(
    <T,>(cmd: string, args: Record<string, unknown> = {}): Promise<T> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("Not connected"));
      }

      const reqId = nextId.current++;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(reqId);
          reject(new Error("Your PC did not respond"));
        }, 30000);

        pending.current.set(reqId, {
          resolve: resolve as (v: unknown) => void,
          reject,
          timer,
        });
        ws.send(JSON.stringify({ t: "client.req", reqId, cmd, args, token }));
      });
    },
    [token],
  );

  return { status, device, call };
}

/** Pairs with a PC using its ID and PIN. Resolves to the token the agent minted. */
export async function pairWithDevice(
  deviceId: string,
  pin: string,
  label: string,
): Promise<{ token: string; device: DeviceInfo }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(clientUrl(deviceId));
    const fail = (m: string) => {
      try {
        ws.close();
      } catch {
        /* already closing */
      }
      reject(new Error(m));
    };

    const timeout = setTimeout(() => fail("Timed out reaching that PC"), 20000);

    ws.onopen = () =>
      ws.send(JSON.stringify({ t: "client.attach", deviceId }));

    ws.onerror = () => {
      clearTimeout(timeout);
      fail("Could not reach Orbit. Check your connection.");
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      if (msg.t === "device.offline") {
        clearTimeout(timeout);
        fail("That PC is offline. Make sure Orbit is running on it.");
        return;
      }

      if (msg.t === "device.online") {
        ws.send(
          JSON.stringify({
            t: "client.req",
            reqId: 1,
            cmd: "pair",
            args: { pin, label },
          }),
        );
        return;
      }

      if (msg.t === "reply") {
        clearTimeout(timeout);
        if (!msg.ok) {
          fail((msg.error as string) || "Pairing failed");
          return;
        }
        const data = msg.data as { token: string; device: DeviceInfo };
        ws.close();
        resolve(data);
      }
    };
  });
}

export function iconUrl(deviceId: string, appId: string) {
  return `${RELAY_HTTP}/icon/${deviceId}/${appId}.png`;
}

/** "Chrome on Windows" style label for the pairing list on the PC. */
export function browserLabel() {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Mac/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "device";
  return `${browser} on ${os}`;
}
