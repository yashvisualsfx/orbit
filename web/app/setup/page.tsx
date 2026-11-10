"use client";

import { useEffect, useRef, useState } from "react";
import { SiteNav } from "@/components/site-chrome";
import { OrbitMark } from "@/components/icons";
import { Qr } from "@/components/qr";

type Pairing = { deviceId: string; pin: string; name: string; link: string };

export default function SetupPage() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [copied, setCopied] = useState<"id" | "pin" | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const deviceId = params.get("d") || "";
    const pin = params.get("p") || "";
    const name = params.get("n") || "Your PC";

    // Keep the PIN out of the address bar/history. It remains in page memory
    // only, and the QR itself carries it in a URL fragment (never sent to server).
    window.history.replaceState(null, "", window.location.pathname);

    if (!deviceId || !pin) return;

    const invite = new URLSearchParams({ d: deviceId, p: pin, n: name });
    const link = `${window.location.origin}/connect#${invite.toString()}`;
    setPairing({ deviceId, pin, name, link });
  }, []);

  async function copy(value: string, kind: "id" | "pin") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[760px]">
          <header className="text-center">
            <OrbitMark className="mx-auto size-10" />
            <p className="eyebrow mt-5">ORBIT SETUP</p>
            <h1 className="display-lg mt-2">Connect your phone to this PC.</h1>
            <p className="lede mx-auto mt-3 max-w-[560px] text-[16px]">
              Orbit is being installed on <strong style={{ color: "var(--fg)" }}>{pairing?.name || "your computer"}</strong>.
              Use either method below to pair a phone or another browser.
            </p>
          </header>

          {!pairing ? (
            <section className="inset-group mt-9 p-6 text-center">
              <h2 className="text-[18px] font-semibold">Pairing details unavailable</h2>
              <p className="lede mt-2 text-[15px]">
                Close this tab and open Orbit.exe again. Keep the app running while pairing.
              </p>
            </section>
          ) : (
            <>
              <section className="mt-9 grid gap-5 rounded-[22px] border p-5 sm:grid-cols-[1fr_1fr] sm:items-center sm:p-7" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-elevated)", boxShadow: "var(--shadow-card)" }}>
                <div className="text-center">
                  <div className="mx-auto inline-flex rounded-[18px] bg-white p-3">
                    <Qr value={pairing.link} className="size-[224px] sm:size-[248px]" label="Scan to pair Orbit with this PC" />
                  </div>
                  <p className="mt-3 text-[14px] font-medium">Method 1 · Scan QR</p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                    Open your phone camera and scan this code.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="eyebrow">METHOD 2 · ENTER MANUALLY</p>
                  <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--separator)", background: "var(--bg-secondary)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>Device ID</span>
                      <button onClick={() => copy(pairing.deviceId, "id")} className="text-[13px] font-medium" style={{ color: "var(--link)" }}>
                        {copied === "id" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="tabular mt-2 break-all text-[20px] font-semibold tracking-wide">{pairing.deviceId}</p>
                  </div>
                  <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--separator)", background: "var(--bg-secondary)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>Pairing PIN</span>
                      <button onClick={() => copy(pairing.pin, "pin")} className="text-[13px] font-medium" style={{ color: "var(--link)" }}>
                        {copied === "pin" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="tabular mt-2 text-[28px] font-semibold tracking-[0.2em]">{pairing.pin}</p>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
                    On the phone, open the Orbit connect page, choose manual pairing, then enter both values.
                  </p>
                </div>
              </section>

              <section className="mt-7">
                <h2 className="display-md">How to connect</h2>
                <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    ["01", "Open Orbit on your phone", "Use your phone's browser and visit the Orbit website, or scan the QR above."],
                    ["02", "Pair your device", "Scan the code for automatic pairing, or enter the Device ID and PIN manually."],
                    ["03", "You're connected", "Your phone is saved. Next time, open Orbit and it will reconnect without entering a code."],
                  ].map(([number, title, description]) => (
                    <li key={number} className="rounded-[16px] border p-4" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-elevated)" }}>
                      <span className="eyebrow">{number}</span>
                      <h3 className="mt-2 text-[16px] font-semibold">{title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>{description}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="mt-6 rounded-[13px] px-4 py-3 text-[13px] leading-relaxed" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--fg-secondary)" }}>
                <strong style={{ color: "var(--fg)" }}>Keep this page private.</strong> Anyone with these pairing details can get access to this PC. Only share them with people you trust.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
