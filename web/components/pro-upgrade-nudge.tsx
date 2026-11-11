"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function ProUpgradeNudge() {
  const [visible, setVisible] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;

    const syncNudge = (user: User | null) => {
      const metadata = user?.user_metadata;
      const eligible = Boolean(
        user &&
        metadata?.orbit_onboarding_completed === true &&
        metadata?.orbit_selected_plan === "free"
      );

      if (!eligible || !user) {
        setVisible(false);
        setStorageKey(null);
        return;
      }

      const key = `orbit-pro-nudge-${user.id}`;
      setStorageKey(key);
      try {
        const dismissedOn = window.localStorage.getItem(key);
        setVisible(dismissedOn !== todayKey());
      } catch {
        setVisible(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => syncNudge(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncNudge(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  function dismiss() {
    try {
      if (storageKey) window.localStorage.setItem(storageKey, todayKey());
    } catch {
      // The nudge still closes for this render if storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Orbit Pro plan preview"
      className="fixed inset-x-3 z-[80] mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl border p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5"
      style={{
        bottom: "max(12px, env(safe-area-inset-bottom))",
        background: "var(--bg-elevated)",
        borderColor: "var(--separator)",
        color: "var(--fg)",
        boxShadow: "0 18px 60px rgba(0,0,0,.22)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Want more from Orbit?</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
          Take a look at the Pro plan preview. Paid upgrades aren’t active yet.
        </p>
        <Link
          href="/pricing"
          onClick={dismiss}
          className="mt-2 inline-flex text-xs font-bold"
          style={{ color: "var(--link)" }}
        >
          Explore Pro <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Pro reminder for today"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}
      >
        ×
      </button>
    </aside>
  );
}
