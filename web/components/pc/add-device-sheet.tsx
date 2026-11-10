"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Spinner } from "@/components/icons";
import { Qr } from "@/components/qr";
import { Sheet } from "@/components/sheet";
import { pairingLink } from "@/lib/orbit";

type Invite = { code: string; expiresIn: number };
type Method = "qr" | "manual";

export function AddDeviceSheet({
  open,
  onClose,
  deviceId,
  token,
  call,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  token: string;
  call: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"link" | "id" | "pin" | null>(null);
  const [method, setMethod] = useState<Method>("qr");

  const request = useCallback(async () => {
    setError("");
    setInvite(null);
    setShared(false);
    setCopied(null);
    try {
      const data = await call<Invite>("device.invite");
      setInvite(data);
      setSecondsLeft(data.expiresIn);
    } catch {
      // Older agents fall back to a shared pairing link.
      setShared(true);
    }
  }, [call]);

  useEffect(() => {
    if (!open) return;
    // request() only writes state once the PC has answered.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMethod("qr");
    request();
  }, [open, request]);

  useEffect(() => {
    if (!invite || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [invite, secondsLeft]);

  const expired = Boolean(invite) && secondsLeft <= 0;
  const link = invite
    ? `${location.origin}/connect#d=${encodeURIComponent(deviceId)}&p=${invite.code}`
    : shared
      ? pairingLink({ deviceId, token })
      : "";

  async function copy(value: string, kind: "link" | "id" | "pin") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Couldn't copy. Please select and copy the value manually.");
    }
  }

  const copyButton = (kind: "id" | "pin", value: string) => (
    <button
      type="button"
      onClick={() => copy(value, kind)}
      className="btn btn-quiet shrink-0"
      aria-label={`Copy ${kind === "id" ? "Device ID" : "PIN"}`}
    >
      {copied === kind ? <Check className="size-[17px]" /> : <Copy className="size-[17px]" />}
      {copied === kind ? "Copied" : "Copy"}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Add a device">
      {!invite && !shared ? (
        <div className="grid place-items-center py-14" style={{ color: "var(--fg-tertiary)" }}>
          <Spinner className="size-6" />
        </div>
      ) : (
        <div>
          {invite && (
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-[12px] p-1" style={{ background: "var(--bg-secondary)" }}>
              <button
                type="button"
                onClick={() => setMethod("qr")}
                className="rounded-[9px] px-3 py-2.5 text-[14px] font-medium"
                style={{
                  background: method === "qr" ? "var(--bg-elevated)" : "transparent",
                  color: method === "qr" ? "var(--fg)" : "var(--fg-secondary)",
                  boxShadow: method === "qr" ? "var(--shadow-card)" : "none",
                }}
              >
                Scan QR
              </button>
              <button
                type="button"
                onClick={() => setMethod("manual")}
                className="rounded-[9px] px-3 py-2.5 text-[14px] font-medium"
                style={{
                  background: method === "manual" ? "var(--bg-elevated)" : "transparent",
                  color: method === "manual" ? "var(--fg)" : "var(--fg-secondary)",
                  boxShadow: method === "manual" ? "var(--shadow-card)" : "none",
                }}
              >
                Enter ID + PIN
              </button>
            </div>
          )}

          {shared ? (
            <>
              <p className="text-[15px]" style={{ color: "var(--fg-secondary)" }}>
                Open this link on the other device. This older Orbit agent shares this device's access, so forgetting this PC here signs both devices out.
              </p>
              <div className="mt-5 flex justify-center rounded-[18px] bg-white p-3">
                <Qr value={link} className="size-[212px]" label="Pairing QR code" />
              </div>
              <button onClick={() => copy(link, "link")} className="btn btn-quiet mt-5 w-full">
                {copied === "link" ? <Check className="size-[18px]" /> : <Copy className="size-[18px]" />}
                {copied === "link" ? "Copied" : "Copy secure link"}
              </button>
            </>
          ) : method === "qr" ? (
            <>
              <p className="text-[15px]" style={{ color: "var(--fg-secondary)" }}>
                New user: open the camera on their phone and scan this QR code.
              </p>
              <div className="mt-5 flex justify-center">
                <div
                  className="rounded-[18px] bg-white p-3"
                  style={{
                    boxShadow: "var(--shadow-card)",
                    opacity: expired ? 0.25 : 1,
                    transition: "opacity 0.25s ease",
                  }}
                >
                  <Qr value={link} className="size-[212px]" label="Pairing QR code" />
                </div>
              </div>
              <p className="mt-3 text-center text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                {expired
                  ? "This code has expired."
                  : `Temporary code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
              </p>
              <button onClick={() => copy(link, "link")} disabled={expired} className="btn btn-quiet mt-4 w-full disabled:opacity-40">
                {copied === "link" ? <Check className="size-[18px]" /> : <Copy className="size-[18px]" />}
                {copied === "link" ? "Copied" : "Copy QR link"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px]" style={{ color: "var(--fg-secondary)" }}>
                On the new phone or laptop, open Orbit and choose manual connection. Enter these two values:
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-[13px] border p-3" style={{ borderColor: "var(--separator)" }}>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>Device ID</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular min-w-0 break-all text-[19px] font-semibold">{deviceId}</span>
                    {copyButton("id", deviceId)}
                  </div>
                </div>
                <div className="rounded-[13px] border p-3" style={{ borderColor: "var(--separator)" }}>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>Temporary PIN</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular text-[25px] font-semibold tracking-[0.2em]">{invite?.code}</span>
                    {copyButton("pin", invite?.code ?? "")}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                {expired
                  ? "This PIN has expired. Generate a new one to connect."
                  : `PIN expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}. It can be used once.`}
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="mt-4 text-center text-[13px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {expired && (
            <button onClick={request} className="btn btn-primary mt-5 w-full">
              Generate new PIN
            </button>
          )}

          <p className="mt-5 text-[12.5px] leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
            Only share these pairing details with someone you trust. They will be able to control this PC after pairing.
          </p>
        </div>
      )}
    </Sheet>
  );
}
