"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark, Spinner } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { browserLabel, clearHash, pairWithDevice, readInviteFromHash, storePairing } from "@/lib/orbit";

type Phase = "checking" | "joining" | "joined" | "ready";

export default function ConnectPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [pcName, setPcName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Keep a QR fragment in this tab while the user signs in. It is never sent
    // to the server and is removed as soon as pairing starts.
    if (window.location.hash) sessionStorage.setItem("orbit.pendingConnectHash", window.location.hash);
    if (!supabase) {
      setAuthReady(true);
      setPhase("ready");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (user.user_metadata?.orbit_onboarding_completed !== true) {
      setPhase("ready");
      return;
    }
    const pending = window.location.hash || sessionStorage.getItem("orbit.pendingConnectHash") || "";
    if (!pending) {
      setPhase("ready");
      return;
    }
    if (!window.location.hash) window.history.replaceState(null, "", window.location.pathname + pending);
    const invite = readInviteFromHash();
    clearHash();
    sessionStorage.removeItem("orbit.pendingConnectHash");
    if (!invite) {
      setPhase("ready");
      return;
    }
    if (invite.kind === "resume") {
      storePairing(invite.deviceId, invite.token);
      setPhase("joined");
      router.replace("/pc");
      return;
    }
    let cancelled = false;
    setPcName(invite.name || "Your PC");
    setPhase("joining");
    pairWithDevice(invite.deviceId, invite.pin, browserLabel())
      .then(({ token }) => {
        if (cancelled) return;
        storePairing(invite.deviceId, token);
        setPhase("joined");
        window.setTimeout(() => router.replace("/pc"), 650);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Pairing failed. Try again from your PC.");
        setPhase("ready");
      });
    return () => { cancelled = true; };
  }, [authReady, user, router]);

  const onboardingDone = user?.user_metadata?.orbit_onboarding_completed === true;

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <section className="glow-card w-full max-w-[620px] rounded-[30px] p-7 text-center sm:p-10">
          <OrbitMark className="mx-auto size-12" />
          {!authReady || phase === "checking" || phase === "joining" ? (
            <>
              <div className="mt-8 flex justify-center"><Spinner className="size-7" /></div>
              <h1 className="display-md mt-5">{phase === "joining" ? "Connecting your device…" : "Checking your Orbit account…"}</h1>
              <p className="lede mt-3 text-base">{phase === "joining" ? `Pairing ${pcName || "your PC"} securely. Keep Orbit running on the computer.` : "Just a moment."}</p>
            </>
          ) : phase === "joined" ? (
            <>
              <p className="eyebrow mt-7">Secure pairing complete</p>
              <h1 className="display-lg mt-3">You’re connected.</h1>
              <p className="lede mt-3 text-base">Opening your device dashboard…</p>
            </>
          ) : !user ? (
            <>
              <p className="eyebrow mt-7">Your devices, one place</p>
              <h1 className="display-lg mt-3">Sign in to connect a PC.</h1>
              <p className="lede mx-auto mt-4 max-w-[440px] text-base">Your Orbit account keeps your devices and plan together. Sign in first, then come back here to pair your computer.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/login" className="btn btn-primary">Sign in / Create account</Link>
                <Link href="/pricing" className="btn btn-secondary">View plans</Link>
              </div>
            </>
          ) : !onboardingDone ? (
            <>
              <p className="eyebrow mt-7">One quick step</p>
              <h1 className="display-lg mt-3">Finish setting up your account.</h1>
              <p className="lede mt-3 text-base">Choose your Orbit plan and complete your welcome setup before connecting a PC.</p>
              <Link href="/login" className="btn btn-primary mt-8">Continue account setup</Link>
            </>
          ) : (
            <>
              <p className="eyebrow mt-7">Orbit for Windows</p>
              <h1 className="display-lg mt-3">Bring this PC into Orbit.</h1>
              <p className="lede mx-auto mt-4 max-w-[470px] text-base">Install the lightweight Windows agent. Once it’s running, choose Connect below to reveal a fresh QR code and pairing PIN.</p>
              {error && <p role="alert" className="mt-5 rounded-xl p-3 text-sm" style={{ color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>{error}</p>}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Link href="/download" className="btn btn-secondary w-full">Download Orbit for Windows</Link>
                <a href="orbit://connect" className="btn btn-primary w-full">Connect this PC</a>
              </div>
              <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>Already installed? Select Connect this PC and allow your browser to open Orbit. The pairing screen opens only when you request it.</p>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
