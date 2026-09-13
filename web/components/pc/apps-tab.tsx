"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppEntry, iconUrl } from "@/lib/orbit";
import { useToast } from "@/components/toast";
import { Close, Search, Star } from "@/components/icons";

type Props = {
  deviceId: string;
  apps: AppEntry[];
  favorites: Set<string>;
  call: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  onFavoritesChange: (next: Set<string>) => void;
};

export function AppsTab({ deviceId, apps, favorites, call, onFavoritesChange }: Props) {
  const [query, setQuery] = useState("");
  const toast = useToast();

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps),
    [apps, q],
  );

  // Favourites only get their own shelf when the user is not searching.
  const pinned = q ? [] : apps.filter((a) => favorites.has(a.id));
  const rest = q ? matches : matches.filter((a) => !favorites.has(a.id));

  async function launch(app: AppEntry) {
    try {
      await call("apps.launch", { id: app.id });
      toast(`Opening ${app.name}`, { tone: "success" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open", { tone: "error" });
    }
  }

  async function toggleFavorite(app: AppEntry) {
    const on = !favorites.has(app.id);
    const next = new Set(favorites);
    if (on) next.add(app.id);
    else next.delete(app.id);
    onFavoritesChange(next);

    try {
      await call("apps.favorite", { id: app.id, on });
    } catch {
      onFavoritesChange(favorites);
      toast("Could not update favourites", { tone: "error" });
    }
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2"
          strokeWidth={2}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps"
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search apps"
          className="w-full rounded-[11px] border py-2.5 pl-10 pr-10 text-[16px] outline-none transition-colors"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--separator)",
            color: "var(--fg)",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full"
            style={{ color: "var(--fg-tertiary)" }}
          >
            <Close className="size-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {pinned.length > 0 && (
        <>
          <SectionLabel>Favourites</SectionLabel>
          <Grid>
            {pinned.map((a) => (
              <AppTile
                key={a.id}
                app={a}
                deviceId={deviceId}
                pinned
                onLaunch={launch}
                onLongPress={toggleFavorite}
              />
            ))}
          </Grid>
        </>
      )}

      <SectionLabel>
        {q ? `${matches.length} result${matches.length === 1 ? "" : "s"}` : "All apps"}
      </SectionLabel>

      {rest.length === 0 ? (
        <p className="py-14 text-center text-[15px]" style={{ color: "var(--fg-secondary)" }}>
          {q ? "No apps match that search." : "No apps indexed yet."}
        </p>
      ) : (
        <Grid>
          {rest.map((a) => (
            <AppTile
              key={a.id}
              app={a}
              deviceId={deviceId}
              pinned={favorites.has(a.id)}
              onLaunch={launch}
              onLongPress={toggleFavorite}
            />
          ))}
        </Grid>
      )}

      <p className="mt-8 text-center text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
        Press and hold an app to pin it.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 mt-6 px-0.5 text-[12px] font-semibold uppercase tracking-[0.06em] first:mt-0"
      style={{ color: "var(--fg-tertiary)" }}
    >
      {children}
    </h2>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-6 md:grid-cols-8">
      {children}
    </div>
  );
}

function initials(name: string) {
  const words = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

function AppTile({
  app,
  deviceId,
  pinned,
  onLaunch,
  onLongPress,
}: {
  app: AppEntry;
  deviceId: string;
  pinned: boolean;
  onLaunch: (a: AppEntry) => void;
  onLongPress: (a: AppEntry) => void;
}) {
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startHold = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      navigator.vibrate?.(20);
      onLongPress(app);
    }, 480);
  };

  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        setBusy(true);
        setTimeout(() => setBusy(false), 700);
        navigator.vibrate?.(10);
        onLaunch(app);
      }}
      className="relative flex touch-manipulation select-none flex-col items-center gap-1.5 rounded-[14px] px-1 py-2.5 transition-[background-color,transform] duration-150 active:scale-90"
      style={{ background: busy ? "color-mix(in srgb, var(--accent) 14%, transparent)" : undefined }}
    >
      {pinned && (
        <Star
          className="absolute right-1.5 top-1.5 size-3"
          filled
          // Decorative: the pinned state is also announced in the label below.
        />
      )}

      {app.icon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl(deviceId, app.id)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="size-[52px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
        />
      ) : (
        <span
          className="grid size-[52px] place-items-center rounded-[13px] text-[19px] font-semibold"
          style={{ background: "var(--bg-tertiary)", color: "var(--fg-secondary)" }}
        >
          {initials(app.name)}
        </span>
      )}

      <span
        className="line-clamp-2 w-full text-center text-[11.5px] leading-[1.25]"
        style={{ color: "var(--fg-secondary)" }}
      >
        {app.name}
      </span>
    </button>
  );
}
