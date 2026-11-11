"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark, Download, Spinner } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DownloadPage() {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const onboarded = user?.user_metadata?.orbit_onboarding_completed === true;

  useEffect(() => {
    if (!supabase || !user || !onboarded) return;
    let active = true;
    setPreparing(true);
    setDownloadError("");
    supabase.storage.from("orbit-downloads").createSignedUrl("Orbit.exe", 300)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setDownloadUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setDownloadError("The private installer has not been uploaded to Orbit Storage yet. Please try again after setup is complete.");
      })
      .finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [supabase, user, onboarded]);

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <section className="glow-card w-full max-w-[620px] rounded-[30px] p-8 text-center sm:p-11">
          <OrbitMark className="mx-auto size-12" />
          <p className="eyebrow mt-7">ORBIT FOR WINDOWS</p>
          <h1 className="display-lg mt-3">Your PC is one download away.</h1>
          <p className="lede mx-auto mt-4 max-w-[470px] text-base">Sign in first so your Windows agent and devices stay connected to your Orbit account.</p>
          {checking ? (
            <div className="mt-9 flex justify-center"><Spinner className="size-7" /></div>
          ) : !user ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/login" className="btn btn-primary w-full">Sign in / Create account</Link>
              <Link href="/pricing" className="btn btn-secondary w-full">Compare plans</Link>
            </div>
          ) : !onboarded ? (
            <div className="mt-8">
              <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>Finish your welcome setup before downloading the agent.</p>
              <Link href="/login" className="btn btn-primary mt-4">Complete account setup</Link>
            </div>
          ) : (
            <div className="mt-8">
              <a href={downloadUrl || undefined} aria-disabled={!downloadUrl || preparing} className="btn btn-primary" style={{ opacity: !downloadUrl || preparing ? 0.55 : 1, pointerEvents: !downloadUrl || preparing ? "none" : "auto" }}>
                {preparing ? <Spinner className="size-[18px]" /> : <Download className="size-[18px]" />}
                {preparing ? "Preparing secure download…" : "Download Orbit.exe"}
              </a>
              {downloadError && <p role="status" className="mx-auto mt-4 max-w-[440px] rounded-xl p-3 text-xs leading-relaxed" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>{downloadError}</p>}
              <div className="mx-auto mt-6 max-w-[440px] rounded-2xl border p-4 text-left" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-secondary)" }}>
                <p className="text-sm font-semibold">After downloading</p>
                <ol className="mt-3 space-y-2 text-sm" style={{ color: "var(--fg-secondary)" }}>
                  <li>1. Open Orbit.exe and allow Windows to run it.</li>
                  <li>2. Orbit installs its background agent and opens this website.</li>
                  <li>3. Choose Connect a PC to display the pairing QR and PIN.</li>
                </ol>
              </div>
              <Link href="/connect" className="link-arrow mt-6">Continue to Connect a PC →</Link>
            </div>
          )}
          <p className="mt-7 text-xs" style={{ color: "var(--fg-tertiary)" }}>Windows 10 and 11 · No extra runtime required</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
