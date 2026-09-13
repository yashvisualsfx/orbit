"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeviceInfo, clearPairing } from "@/lib/orbit";
import { useToast } from "@/components/toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { AddDeviceSheet } from "@/components/pc/add-device-sheet";
import {
  Backward,
  ChevronRight,
  Forward,
  Lock,
  Moon,
  Pause,
  Power,
  QrCode,
  SpeakerOff,
  SpeakerWave,
} from "@/components/icons";

type Props = {
  device: DeviceInfo | null;
  deviceId: string;
  token: string;
  appCount: number;
  call: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  active: boolean;
};

type SysStatus = { volume: number; muted: boolean; host: string; user: string };

export function RemoteTab({ device, deviceId, token, appCount, call, active }: Props) {
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [addingDevice, setAddingDevice] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const dragging = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await call<SysStatus>("sys.status");
      if (!dragging.current) setVolume(s.volume);
      setMuted(s.muted);
    } catch {
      /* the shell already shows the offline state */
    }
  }, [call]);

  useEffect(() => {
    if (!active) return;
    // refresh() only writes state once its reply arrives from the PC.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [active, refresh]);

  const fail = (err: unknown) =>
    toast(err instanceof Error ? err.message : "Failed", { tone: "error" });

  function onVolume(value: number) {
    setVolume(value);
    dragging.current = true;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      dragging.current = false;
      call("sys.volume", { value }).catch(fail);
    }, 110);
  }

  async function power(action: string) {
    const destructive = action === "shutdown" || action === "restart";

    if (destructive && armed !== action) {
      setArmed(action);
      setTimeout(() => setArmed((a) => (a === action ? null : a)), 4000);
      return;
    }
    setArmed(null);

    try {
      await call("sys.power", { action });
      if (destructive) {
        toast(`${action === "shutdown" ? "Shutting down" : "Restarting"} in 20s`, {
          duration: 19000,
          action: {
            label: "Cancel",
            onClick: () =>
              call("sys.power", { action: "cancel" })
                .then(() => toast("Cancelled", { tone: "success" }))
                .catch(fail),
          },
        });
      } else {
        toast(action === "lock" ? "PC locked" : "Going to sleep", { tone: "success" });
      }
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="space-y-7">
      {/* ------------------------------------------------------------ volume */}
      <section>
        <Label>Volume</Label>
        <div className="inset-group px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <button
              onClick={async () => {
                try {
                  const r = await call<{ muted: boolean }>("sys.mute");
                  setMuted(r.muted);
                } catch (err) {
                  fail(err);
                }
              }}
              aria-label={muted ? "Unmute" : "Mute"}
              className="grid size-11 shrink-0 place-items-center rounded-[11px] transition-transform active:scale-92"
              style={{
                background: "var(--bg-tertiary)",
                color: muted ? "var(--danger)" : "var(--fg)",
              }}
            >
              {muted ? <SpeakerOff className="size-5" /> : <SpeakerWave className="size-5" />}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-9 flex-1 accent-[var(--accent)]"
            />

            <span
              className="tabular w-9 shrink-0 text-right text-[15px] font-medium"
              style={{ color: "var(--fg-secondary)" }}
            >
              {volume}
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- media */}
      <section>
        <Label>Media</Label>
        <div className="inset-group flex items-center justify-center gap-7 py-5">
          <MediaButton onClick={() => call("sys.media", { key: "prev" }).catch(fail)} label="Previous">
            <Backward className="size-6" />
          </MediaButton>
          <MediaButton
            primary
            onClick={() => call("sys.media", { key: "playpause" }).catch(fail)}
            label="Play or pause"
          >
            <Pause className="size-7" />
          </MediaButton>
          <MediaButton onClick={() => call("sys.media", { key: "next" }).catch(fail)} label="Next">
            <Forward className="size-6" />
          </MediaButton>
        </div>
      </section>

      {/* ---------------------------------------------------------- keyboard */}
      <section>
        <Label>Keyboard</Label>
        <div className="inset-group p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Type here, send to PC"
              aria-label="Text to send to the PC"
              className="min-w-0 flex-1 rounded-[10px] border px-3 py-2.5 text-[16px] outline-none"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--separator)",
                color: "var(--fg)",
              }}
            />
            <button
              onClick={send}
              disabled={!text}
              className="shrink-0 rounded-[10px] px-4 text-[15px] font-medium text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Send
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["Enter", "{ENTER}"],
              ["Tab", "{TAB}"],
              ["Esc", "{ESC}"],
              ["Backspace", "{BACKSPACE}"],
              ["Alt+F4", "%{F4}"],
            ].map(([label, code]) => (
              <button
                key={code}
                onClick={() => call("sys.key", { value: code }).catch(fail)}
                className="rounded-[9px] border px-3 py-2 text-[13.5px] transition-transform active:scale-95"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--separator)" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- power */}
      <section>
        <Label>Power</Label>
        <div className="grid grid-cols-2 gap-2.5">
          <PowerButton onClick={() => power("lock")} icon={<Lock className="size-5" />}>
            Lock
          </PowerButton>
          <PowerButton onClick={() => power("sleep")} icon={<Moon className="size-5" />}>
            Sleep
          </PowerButton>
          <PowerButton
            danger
            armed={armed === "restart"}
            onClick={() => power("restart")}
            icon={<Power className="size-5" />}
          >
            {armed === "restart" ? "Tap to confirm" : "Restart"}
          </PowerButton>
          <PowerButton
            danger
            armed={armed === "shutdown"}
            onClick={() => power("shutdown")}
            icon={<Power className="size-5" />}
          >
            {armed === "shutdown" ? "Tap to confirm" : "Shut down"}
          </PowerButton>
        </div>
        <p className="mt-3 px-1 text-[12.5px]" style={{ color: "var(--fg-tertiary)" }}>
          Shutdown and restart wait 20 seconds. Tap Cancel in the message to stop it.
        </p>
      </section>

      {/* ---------------------------------------------------------- devices */}
      <section>
        <Label>Devices</Label>
        <div className="inset-group">
          <button className="inset-row justify-between" onClick={() => setAddingDevice(true)}>
            <span className="flex items-center gap-3">
              <QrCode className="size-[19px]" style={{ color: "var(--accent)" }} />
              Add a phone or laptop
            </span>
            <ChevronRight className="size-4" style={{ color: "var(--fg-tertiary)" }} />
          </button>
          <div className="inset-row justify-between">
            <span style={{ color: "var(--fg-secondary)" }}>Appearance</span>
            <ThemeToggle />
          </div>
        </div>
        <p className="mt-2 px-1 text-[12.5px]" style={{ color: "var(--fg-tertiary)" }}>
          This device stays paired through restarts. You only enter a code once.
        </p>
      </section>

      {/* ------------------------------------------------------------- about */}
      <section>
        <Label>This PC</Label>
        <div className="inset-group">
          <Row label="Name" value={device?.name ?? "—"} />
          <Row label="Device ID" value={deviceId} mono />
          <Row label="Apps indexed" value={String(appCount)} />
          <Row label="Windows" value={device?.platform ?? "—"} />
          <button
            className="inset-row justify-center text-[15px] font-medium"
            style={{ color: "var(--danger)" }}
            onClick={() => {
              clearPairing();
              router.replace("/connect");
            }}
          >
            Forget this PC
          </button>
        </div>
      </section>

      <AddDeviceSheet
        open={addingDevice}
        onClose={() => setAddingDevice(false)}
        deviceId={deviceId}
        token={token}
        call={call}
      />
    </div>
  );

  async function send() {
    if (!text) return;
    try {
      await call("sys.type", { text });
      setText("");
      toast("Sent", { tone: "success", duration: 1400 });
    } catch (err) {
      fail(err);
    }
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em]"
      style={{ color: "var(--fg-tertiary)" }}
    >
      {children}
    </h2>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="inset-row justify-between">
      <span style={{ color: "var(--fg-secondary)" }}>{label}</span>
      <span className={`truncate text-[15px] font-medium ${mono ? "tabular" : ""}`}>{value}</span>
    </div>
  );
}

function MediaButton({
  children,
  onClick,
  label,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={() => {
        navigator.vibrate?.(10);
        onClick();
      }}
      aria-label={label}
      className={`grid place-items-center rounded-full transition-transform active:scale-90 ${
        primary ? "size-[66px]" : "size-14"
      }`}
      style={
        primary
          ? { background: "var(--accent)", color: "#fff" }
          : { background: "var(--bg-tertiary)", color: "var(--fg)" }
      }
    >
      {children}
    </button>
  );
}

function PowerButton({
  children,
  onClick,
  icon,
  danger,
  armed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  armed?: boolean;
}) {
  const style = armed
    ? { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }
    : {
        background: "var(--bg-elevated)",
        color: danger ? "var(--danger)" : "var(--fg)",
        borderColor: danger
          ? "color-mix(in srgb, var(--danger) 30%, transparent)"
          : "var(--separator-soft)",
      };

  return (
    <button
      onClick={onClick}
      className="flex min-h-[58px] items-center justify-center gap-2 rounded-[14px] border text-[15px] font-medium transition-[background-color,transform] active:scale-97"
      style={style}
    >
      {icon}
      {children}
    </button>
  );
}
