"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark, Spinner } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearPairing, readStored, reinforcePairing, useOrbit, usePairing } from "@/lib/orbit";

export default function PcPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const pairing = usePairing();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { status, device, call } = useOrbit(pairing.deviceId, pairing.token);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
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
    if (!authReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.user_metadata?.orbit_onboarding_completed !== true) {
      router.replace("/login");
      return;
    }
    const stored = readStored();
    if (!stored.deviceId || !stored.token) {
      router.replace("/connect");
      return;
    }
    reinforcePairing();
  }, [authReady, user, router]);

  useEffect(() => {
    if (status !== "online") return;
    call<{ clients: { label: string; pairedAt: string }[] }>("device.clients")
      .then((data) => setClientCount(data.clients?.length ?? 0))
      .catch(() => setClientCount(null));
  }, [status, call]);

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    clearPairing();
    router.replace("/login");
  }

  if (!authReady || !user || !pairing.deviceId || !pairing.token) {
    return <main className="grid min-h-screen flex-1 place-items-center"><Spinner className="size-7" /></main>;
  }

  const online = status === "online";
  const plan = String(user.user_metadata?.orbit_selected_plan || "free");

  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[1040px] flex-1 px-5 py-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">ORBIT CONTROL CENTER</p>
            <h1 className="display-lg mt-2">Your devices.</h1>
            <p className="lede mt-3 text-base">A clear view of your PC connection and account security.</p>
          </div>
          <button onClick={signOut} disabled={signingOut} className="btn btn-secondary">
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <section className="glow-card mt-9 overflow-hidden rounded-[28px] p-6 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--accent) 13%, var(--bg-secondary))", color: "var(--accent)" }}>
                <OrbitMark className="size-8" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--fg-tertiary)" }}>Windows device</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{device?.name || "Your PC"}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--fg-secondary)" }}>{device?.platform || "Waiting for device details"}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold" style={{ borderColor: online ? "color-mix(in srgb, var(--success) 35%, var(--separator))" : "var(--separator)", background: online ? "color-mix(in srgb, var(--success) 10%, transparent)" : "var(--bg-secondary)", color: online ? "var(--success)" : "var(--fg-secondary)" }}>
              <span className={online ? "status-pulse size-2 rounded-full" : "size-2 rounded-full"} style={{ background: online ? "var(--success)" : "var(--fg-tertiary)" }} />
              {online ? "Connected" : status === "connecting" ? "Connecting…" : "PC offline"}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Info label="Device ID" value={pairing.deviceId} />
            <Info label="Paired browsers" value={clientCount === null ? "—" : String(clientCount)} />
            <Info label="Agent version" value={device?.agentVersion || "—"} />
          </div>

          {!online && (
            <div className="mt-6 rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>
              Keep Orbit running on your Windows PC and check that it has an internet connection. Orbit will retry automatically.
            </div>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="orbit://connect" className="btn btn-primary">Open pairing screen</a>
            <Link href="/connect" className="btn btn-secondary">Connect another PC</Link>
          </div>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="glow-card rounded-[24px] p-6">
            <p className="eyebrow">ACCOUNT</p>
            <h3 className="mt-3 text-xl font-semibold">{user.user_metadata?.full_name || user.email}</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-secondary)" }}>{user.email}</p>
            <div className="mt-5 flex items-center justify-between rounded-xl p-3" style={{ background: "var(--bg-secondary)" }}>
              <span className="text-sm" style={{ color: "var(--fg-secondary)" }}>Selected plan</span>
              <span className="text-sm font-semibold capitalize">{plan}</span>
            </div>
            <Link href="/pricing" className="link-arrow mt-5">Explore plans and upgrades →</Link>
          </article>

          <article className="glow-card rounded-[24px] p-6">
            <p className="eyebrow">SECURITY</p>
            <h3 className="mt-3 text-xl font-semibold">Your PC stays in control.</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg-secondary)" }}>Pairing is verified on the Windows agent. Your access token is signed by the PC, and the relay only forwards encrypted connection traffic.</p>
            <div className="mt-5 rounded-xl p-3 text-sm" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>
              Never share your pairing QR, PIN, or device access link with someone you don’t trust.
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-secondary)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--fg-tertiary)" }}>{label}</p>
      <p className="mt-2 break-all text-base font-semibold tabular">{value}</p>
    </div>
  );
}
