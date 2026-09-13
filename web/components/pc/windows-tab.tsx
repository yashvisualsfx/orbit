"use client";

import { useCallback, useEffect, useState } from "react";
import { AppEntry, WindowEntry, iconUrl } from "@/lib/orbit";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/icons";

type Props = {
  deviceId: string;
  apps: AppEntry[];
  call: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  active: boolean;
};

export function WindowsTab({ deviceId, apps, call, active }: Props) {
  const [items, setItems] = useState<WindowEntry[] | null>(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await call<{ items: WindowEntry[] }>("win.list");
      setItems(data.items);
    } catch {
      setItems([]);
    }
  }, [call]);

  // Poll only while this tab is on screen, so a backgrounded browser stays quiet.
  useEffect(() => {
    if (!active) return;
    // refresh() only writes state once its reply arrives from the PC.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [active, refresh]);

  async function act(cmd: string, args: Record<string, unknown>, done: string) {
    try {
      await call(cmd, args);
      toast(done, { tone: "success" });
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", { tone: "error" });
    }
  }

  if (items === null) {
    return (
      <div className="grid place-items-center py-20" style={{ color: "var(--fg-tertiary)" }}>
        <Spinner className="size-6" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-20 text-center text-[15px]" style={{ color: "var(--fg-secondary)" }}>
        Nothing is open right now.
      </p>
    );
  }

  return (
    <div className="inset-group">
      {items.map((w) => {
        const match = w.path
          ? apps.find((a) => a.exe && a.exe.toLowerCase() === w.path!.toLowerCase())
          : undefined;

        return (
          <div key={`${w.pid}-${w.hwnd}`} className="inset-row">
            {match?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconUrl(deviceId, match.id)}
                alt=""
                className="size-8 shrink-0 object-contain"
              />
            ) : (
              <span
                className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[12px] font-semibold"
                style={{ background: "var(--bg-tertiary)", color: "var(--fg-secondary)" }}
              >
                {w.name.slice(0, 2).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{w.title}</p>
              <p className="tabular truncate text-[12.5px]" style={{ color: "var(--fg-tertiary)" }}>
                {w.name} · {w.mem} MB
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => act("win.focus", { pid: w.pid, hwnd: w.hwnd }, "Brought to front")}
                className="rounded-[9px] px-3 py-1.5 text-[13.5px] font-medium transition-transform active:scale-95"
                style={{ background: "var(--bg-tertiary)", color: "var(--fg)" }}
              >
                Show
              </button>
              <button
                onClick={() => act("win.close", { pid: w.pid }, "Closed")}
                className="rounded-[9px] px-3 py-1.5 text-[13.5px] font-medium transition-transform active:scale-95"
                style={{
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                  color: "var(--danger)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
