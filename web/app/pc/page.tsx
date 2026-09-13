"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { AppEntry, readStored, reinforcePairing, useOrbit, usePairing } from "@/lib/orbit";
import { ToastProvider, useToast } from "@/components/toast";
import { AppsTab } from "@/components/pc/apps-tab";
import { WindowsTab } from "@/components/pc/windows-tab";
import { RemoteTab } from "@/components/pc/remote-tab";
import { Grid, Display, Refresh, Sliders, Spinner, OrbitMark } from "@/components/icons";

type Tab = "apps" | "windows" | "remote";

export default function PcPage() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}

function Dashboard() {
  const router = useRouter();
  const toast = useToast();

  // Read through an external store rather than an effect, so hydration gets the
  // stored pairing without a render-phase localStorage access.
  const pairing = usePairing();
  const paired = Boolean(pairing.deviceId && pairing.token);
  const [tab, setTab] = useState<Tab>("apps");
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loadedApps, setLoadedApps] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    // Read localStorage directly here: usePairing still reports the empty server
    // snapshot on the hydration pass, so redirecting off it would bounce a
    // paired user straight back to /connect.
    const stored = readStored();
    if (!stored.deviceId || !stored.token) {
      router.replace("/connect");
      return;
    }

    // Writes the pairing back to both stores and asks the browser to keep them,
    // which is what stops a long gap between visits from losing the pairing.
    reinforcePairing();
  }, [router]);

  const { status, device, call } = useOrbit(pairing.deviceId, pairing.token);

  const loadApps = useCallback(async () => {
    try {
      const data = await call<{ apps: AppEntry[]; favorites: string[] }>("apps.list");
      setApps(data.apps ?? []);
      setFavorites(new Set(data.favorites ?? []));
      setLoadedApps(true);
    } catch {
      /* the header already communicates the connection state */
    }
  }, [call]);

  useEffect(() => {
    // loadApps only writes state after its network reply resolves, which is the
    // "subscribe to an external system" case the rule allows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "online") loadApps();
  }, [status, loadApps]);

  async function rescan() {
    setRescanning(true);
    toast("Scanning your PC…");
    try {
      await call("apps.rescan");
      // The scan runs on the PC; poll until it reports finished.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        const data = await call<{
          apps: AppEntry[];
          favorites: string[];
          scanning: boolean;
        }>("apps.list");
        if (!data.scanning) {
          setApps(data.apps ?? []);
          setFavorites(new Set(data.favorites ?? []));
          toast(`${data.apps.length} apps found`, { tone: "success" });
          break;
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Rescan failed", { tone: "error" });
    } finally {
      setRescanning(false);
    }
  }

  if (!paired) {
    return (
      <main className="grid flex-1 place-items-center" style={{ color: "var(--fg-tertiary)" }}>
        <Spinner className="size-6" />
      </main>
    );
  }

  const online = status === "online";

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl backdrop-saturate-150"
        style={{
          background: "var(--nav-bg)",
          borderColor: "var(--separator-soft)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="mx-auto max-w-[760px] px-4">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <OrbitMark className="size-[22px] shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight">
                  {device?.name ?? "Your PC"}
                </p>
                <p
                  className="flex items-center gap-1.5 text-[12px] leading-tight"
                  style={{ color: "var(--fg-tertiary)" }}
                >
                  <span
                    className="size-[6px] shrink-0 rounded-full"
                    style={{
                      background: online
                        ? "var(--success)"
                        : status === "connecting"
                          ? "var(--fg-tertiary)"
                          : "var(--danger)",
                    }}
                    aria-hidden
                  />
                  {online
                    ? `Online${loadedApps ? ` · ${apps.length} apps` : ""}`
                    : status === "connecting"
                      ? "Connecting…"
                      : "PC is offline"}
                </p>
              </div>
            </div>

            <button
              onClick={rescan}
              disabled={!online || rescanning}
              aria-label="Rescan installed apps"
              className="grid size-9 shrink-0 place-items-center rounded-[10px] border transition-transform active:scale-92 disabled:opacity-40"
              style={{ background: "var(--bg-elevated)", borderColor: "var(--separator-soft)" }}
            >
              <Refresh className={`size-[18px] ${rescanning ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="pb-3">
            <div className="segmented w-full">
              <SegmentButton current={tab} value="apps" onSelect={setTab} icon={<Grid className="size-4" />}>
                Apps
              </SegmentButton>
              <SegmentButton current={tab} value="windows" onSelect={setTab} icon={<Display className="size-4" />}>
                Windows
              </SegmentButton>
              <SegmentButton current={tab} value="remote" onSelect={setTab} icon={<Sliders className="size-4" />}>
                Remote
              </SegmentButton>
            </div>
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-[760px] flex-1 px-4 py-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
      >
        {!online ? (
          <OfflineNotice status={status} />
        ) : !loadedApps ? (
          <div className="grid place-items-center py-24" style={{ color: "var(--fg-tertiary)" }}>
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            <div hidden={tab !== "apps"}>
              <AppsTab
                deviceId={pairing.deviceId}
                apps={apps}
                favorites={favorites}
                call={call}
                onFavoritesChange={setFavorites}
              />
            </div>
            <div hidden={tab !== "windows"}>
              <WindowsTab
                deviceId={pairing.deviceId}
                apps={apps}
                call={call}
                active={tab === "windows"}
              />
            </div>
            <div hidden={tab !== "remote"}>
              <RemoteTab
                device={device}
                deviceId={pairing.deviceId}
                token={pairing.token}
                appCount={apps.length}
                call={call}
                active={tab === "remote"}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}

function SegmentButton({
  current,
  value,
  onSelect,
  icon,
  children,
}: {
  current: Tab;
  value: Tab;
  onSelect: (t: Tab) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = current === value;
  const reduceMotion = useReducedMotion();

  return (
    <button
      aria-pressed={active}
      onClick={() => onSelect(value)}
      className="relative flex flex-1 items-center justify-center gap-1.5"
      style={{ color: active ? "var(--accent)" : "var(--fg-secondary)" }}
    >
      {/* One pill shared by all three segments, so it slides between them. */}
      {active && (
        <motion.span
          layoutId="pc-tab-pill"
          className="absolute inset-0 rounded-[7px]"
          style={{ background: "var(--bg-elevated)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }
          }
        />
      )}
      <span className="relative flex items-center gap-1.5">
        {icon}
        {children}
      </span>
    </button>
  );
}

function OfflineNotice({ status }: { status: string }) {
  return (
    <div className="mx-auto max-w-[420px] py-20 text-center">
      <h2 className="display-md">
        {status === "connecting" ? "Reaching your PC…" : "Your PC is offline"}
      </h2>
      <p className="lede mt-3 text-[16px]">
        {status === "connecting"
          ? "Hang on a moment."
          : "Orbit isn't running on that computer, or it has no internet connection. It will reconnect on its own once it's back."}
      </p>
    </div>
  );
}
