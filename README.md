# Orbit

**Live: https://orbit-rho-ecru.vercel.app**

Control your Windows PC from any browser, anywhere in the world. Your installed
apps appear as a grid on your phone — tap one and it opens on your computer.
Volume, media keys, a keyboard, open windows, and power controls too.

No port forwarding, no static IP, no router configuration: the agent on the PC
makes an outbound connection, so it works from college Wi-Fi, a mobile hotspot,
or a hotel network.

```
browser  ──wss──►  relay (Railway)  ──wss──►  agent (your PC)  ──►  PowerShell
  web app            routes only                 authorises              Windows
```

---

## Repository layout

| Folder   | What it is | Runs on |
|----------|------------|---------|
| `web/`   | Next.js site: landing page, pairing, control dashboard | Vercel |
| `relay/` | WebSocket relay that routes messages between browsers and agents | Railway |
| `agent/` | The Windows agent: app scanning, icon extraction, command execution | The user's PC |
| `scripts/build-exe.mjs` | Builds `Orbit.exe`, stamped with your relay and website URLs | Your machine |

---

## Security model

The relay is deliberately **not** trusted with control of anyone's PC.

- The agent generates a 32-byte **device key** on first run. The public
  **Device ID** (`ORB-4F2A-91C7`) is a hash of that key, so the relay can verify
  an agent owns the ID it claims without the ID being guessable.
- Pairing is forwarded to the agent untouched. The **agent** checks the PIN and
  signs an access token with a secret that never leaves the machine.
- Every later command carries that token and is verified **on the PC** before it
  runs. A compromised relay can disrupt traffic but cannot grant control.
- Eight wrong PINs lock out that requester for five minutes.
- "Forget this PC" on the device clears the browser; rotating the token secret
  (`device.unpairAll`) signs out every paired browser at once.

Traffic passes through the relay in plaintext-over-TLS, so the relay operator
could observe commands. That is the same trust level as any hosted remote-control
product — if that matters to you, run your own relay.

---

## Deploy

### 1. Relay → Railway  ✅ deployed

Live at **https://orbit-relay-production.up.railway.app** (project `orbit-relay`,
service `orbit-relay`). To redeploy after changing relay code:

```bash
cd relay && railway up --ci -y --service orbit-relay
```

To deploy a fresh copy elsewhere: `railway init --name orbit-relay`, then
`railway up`, then `railway domain`. Check it works:

```bash
curl https://orbit-relay-production.up.railway.app/health
# {"ok":true,"devices":0,"uptime":12.3}
```

The relay holds long-lived WebSocket connections, which is why it needs an
always-on host rather than serverless functions.

### Infrastructure as code

Railway's Config as Code (`railway.json`) is deprecated and stops being read on
2026-12-01, so the relay is described in **`relay/.railway/railway.ts`** instead
and `railway.json` is gone. The settings it used to carry — NIXPACKS builder,
`npm start`, the `/health` healthcheck — are now applied to the service itself:

```bash
cd relay
railway config plan     # preview; should say "already up to date"
railway config apply    # write the file's settings to the live service
```

Three things worth knowing, all already handled in the committed file:

- **The service must be named `orbit-relay`.** `railway config migrate` names it
  `relay`, which would make the apply create a *second* service and move the
  public URL. The file was generated with `railway config pull` (which reads the
  live project) and the deploy settings were merged back in by hand.
- **Restart policy is not declared.** `railway.json` asked for `ON_FAILURE` with
  10 retries, which is what Railway already does by default — the dashboard
  shows On Failure / 10 — and the API reports those fields as unset, so
  declaring them would leave `plan` permanently showing a change that can never
  read back as applied.
- **On Windows the SDK's version gate misfires.** `railway/iac` shells out to
  `process.env._ || "railway"` to check the CLI version; Windows never sets `_`,
  and `node --version` prints `v24.19.0`, whose leading `v` defeats the SDK's
  version regex, so the CLI reports "requires Railway CLI 5.42.1 or newer" no
  matter how new it is. Call the real binary, which makes the shell set `_` to
  it:

  ```bash
  "$APPDATA/npm/node_modules/@railway/cli/bin/railway.exe" config plan
  ```

The `railway` npm package in the repo root is only the authoring SDK for that
file — it is not part of the relay or of the website.

### Heartbeats

The relay pings over **ordinary JSON messages**, not WebSocket ping frames.
Railway's edge proxy does not forward control frames, so a protocol-level
heartbeat silently never gets a pong and the relay tears down healthy
connections after ~50 seconds. Anything that replaces the relay must keep the
application-level `{"t":"ping"}` / `{"t":"pong"}` exchange.

### 2. Website → Vercel  ✅ deployed

Live at **https://orbit-rho-ecru.vercel.app** (project `orbit`). Redeploy with:

```bash
cd web && vercel --prod --yes
```

`NEXT_PUBLIC_ORBIT_RELAY` is already set to the Railway relay in all three
environments. Two things that silently break this deploy if you recreate it:

- **`web/.env.local` must stay ignored.** It points at `ws://127.0.0.1:8080`, and
  if it ever reaches the build the production bundle bakes in localhost and the
  site can never connect.
- **`web/public/Orbit.exe` must NOT be gitignored.** It looks like a build
  output, but the site serves it — ignore it and the download button 404s.

Add a custom domain with `vercel domains add <domain>` when you have one.

### 3. Build the agent download

The exe the website serves has to know which relay and which website to call:

```bash
node scripts/build-exe.mjs \
  --relay wss://orbit-relay-production.up.railway.app \
  --web   https://orbit-rho-ecru.vercel.app
```

Both flags default to the deployed URLs above. The script writes the URLs into
`agent/src/build.json`, bundles the agent with `@yao-pkg/pkg` into a single
~55 MB binary that needs no Node.js on the user's PC, and copies it to
`web/public/Orbit.exe`. Re-deploy the website afterwards so `/Orbit.exe` serves
the new build.

**Re-run this whenever either URL changes** — copies downloaded earlier keep
pointing at the old ones.

It also flips one byte in the finished binary. pkg can only produce console
programs, and a console program launched by the logon task flashes a black
window at every sign-in; changing the PE subsystem to GUI makes Windows start it
with no console at all. That is why the agent logs to
`%LOCALAPPDATA%\Orbit\agent.log` rather than to stdout — in a packaged build
there is nowhere for stdout to go.

## Run it locally

Three terminals:

```bash
# 1. relay
cd relay && npm install && npm start          # :8080

# 2. website
cd web && npm install && npm run dev          # :3000

# 3. agent
cd agent && npm install
ORBIT_RELAY=ws://127.0.0.1:8080 npm start
```

`web/.env.local` already points at `ws://127.0.0.1:8080`. The agent prints its
Device ID and PIN; enter them at <http://localhost:3000/connect>.

---

## Installing the agent on a PC

Users download **Orbit.exe** from the website and double-click it. There is no
zip to unpack, no installer wizard and no Node.js to install — the binary
carries its own runtime. On first run it:

- copies itself to `%LOCALAPPDATA%\Orbit\bin\Orbit.exe`, so deleting the
  Downloads folder cannot break startup,
- registers a **logon scheduled task** that runs that copy with `--silent`
  (falling back to a plain `ONLOGON` task, then to the per-user `Run` key, if a
  locked-down machine refuses the XML registration),
- adds an **Orbit** shortcut to the Start Menu,
- scans installed apps and extracts their icons (about 6 seconds for ~130 apps),
- starts the agent in the background and opens the pairing page in the browser,
  with the Device ID and PIN already in the URL fragment.

Running the exe again is safe: it only re-does the parts that are missing or out
of date, and re-opens the pairing page. Other flags:

| Flag | What it does |
|------|--------------|
| `--show` | open the pairing page again |
| `--silent` | be the agent — what the logon task runs |
| `--uninstall` | remove the startup entry, shortcut and stop the agent |
| `--scan-only` | re-index installed apps and exit |

Identity and app data live in `%LOCALAPPDATA%\Orbit` and survive reinstalling or
updating the agent; deleting that folder resets the device completely. The
packaged build has no console, so everything it would print goes to
`%LOCALAPPDATA%\Orbit\agent.log`.

---

## What Orbit can and cannot do

**Can:** launch any Start Menu or Store app, list and focus and close open
windows, set the real Windows master volume, send media keys, type text and send
Enter/Tab/Esc/Alt+F4, lock, sleep, restart and shut down.

**Cannot, by design or by physics:**

- **Turn a powered-off PC on.** Software cannot run on a machine that is off.
  This needs Wake-on-LAN, and the magic packet must originate on the same
  network — so it requires another always-on device at that location.
- **Unlock Windows.** The lock screen runs on a secure desktop that refuses
  synthetic input precisely to stop this. Orbit does not work around it.
- **Launch apps that require administrator rights**, because the agent runs as a
  normal user. Start it from an elevated terminal if you need that.

---

## How the Windows side works

- `agent/scripts/scan-apps.ps1` reads Start Menu shortcuts and `Get-StartApps`,
  then pulls each app's 256px icon through `IShellItemImageFactory` — the same
  icon Explorer renders. Store apps get their logo from the package manifest.
  Documentation, uninstaller and "Help" entries are filtered out.
- `agent/scripts/host.ps1` is a long-lived worker reading one JSON command per
  line from stdin. Keeping it warm avoids ~400 ms of PowerShell startup per tap.
- Window enumeration walks top-level windows and, for Store apps, follows the
  `ApplicationFrameWindow` to its `CoreWindow` child to find the real owning
  process — otherwise every Store app reports as the shared `ApplicationFrameHost`
  and closing one would close several.
- Win32 apps launch through their `.lnk` (which carries arguments and working
  directory); Store apps launch via `shell:appsFolder\<AppID>`.
