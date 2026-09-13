"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Spinner } from "@/components/icons";
import { Qr } from "@/components/qr";
import { Sheet } from "@/components/sheet";
import { pairingLink } from "@/lib/orbit";

type Invite = { code: string; expiresIn: number };

/**
 * Adds another phone, tablet or laptop without anyone reading a code off the PC.
 *
 * The PC mints a single-use invite code that expires in five minutes; the QR
 * code points at /connect with that code in the fragment, so scanning it pairs
 * the new device with a token of its own — revocable on its own later.
 *
 * Older agents don't know the invite command. Those fall back to a link carrying
 * this device's own pairing, which works everywhere but shares one token, so the
 * copy says what that means.
 */
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
  const [copied, setCopied] = useState(false);

  const request = useCallback(async () => {
    setError("");
    setInvite(null);
    setShared(false);
    try {
      const data = await call<Invite>("device.invite");
      setInvite(data);
      setSecondsLeft(data.expiresIn);
    } catch {
      // Either the PC is offline, or its agent predates invite codes. The shared
      // link still gets the new device in.
      setShared(true);
    }
  }, [call]);

  useEffect(() => {
    if (!open) return;
    // request() only writes state once the PC has answered.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a device">
      {!invite && !shared ? (
        <div className="grid place-items-center py-14" style={{ color: "var(--fg-tertiary)" }}>
          <Spinner className="size-6" />
        </div>
      ) : (
        <div>
          <p className="text-[15px]" style={{ color: "var(--fg-secondary)" }}>
            {shared
              ? "Open this link on the other device. It joins using this device's access, so forgetting this PC here signs both out."
              : "Point the other device's camera at this code. It pairs itself — there is nothing to type."}
          </p>

          <div className="mt-5 flex justify-center">
            <div
              className="rounded-[18px] p-3"
              style={{
                background: "#ffffff",
                boxShadow: "var(--shadow-card)",
                opacity: expired ? 0.25 : 1,
                transition: "opacity 0.25s ease",
              }}
            >
              <Qr value={link} className="size-[212px]" label="Pairing code" />
            </div>
          </div>

          {invite && (
            <div className="mt-5 text-center">
              <p
                className="tabular text-[28px] font-semibold tracking-[0.18em]"
                style={{ color: expired ? "var(--fg-tertiary)" : "var(--fg)" }}
              >
                {invite.code}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                {expired
                  ? "This code has expired."
                  : `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} · use it with Device ID ${deviceId}`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-center text-[13px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2.5">
            {expired ? (
              <button onClick={request} className="btn btn-primary flex-1">
                New code
              </button>
            ) : (
              <button onClick={copy} className="btn btn-quiet flex-1">
                {copied ? <Check className="size-[18px]" /> : <Copy className="size-[18px]" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            )}
          </div>

          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
            Anyone who scans this can control this PC until you forget it, so don&apos;t
            share it where others can see.
          </p>
        </div>
      )}
    </Sheet>
  );
}
