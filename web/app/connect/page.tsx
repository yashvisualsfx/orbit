"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SiteNav } from "@/components/site-chrome";
import { Check, OrbitMark, Spinner } from "@/components/icons";
import { ENTER, EXIT } from "@/components/motion";
import {
  HashInvite,
  browserLabel,
  clearHash,
  pairWithDevice,
  readInviteFromHash,
  storePairing,
} from "@/lib/orbit";

/*
 * The invitation is taken out of the URL once per page load, and the pairing
 * request is made once for it — both held outside the component on purpose.
 *
 * The fragment has to be cleared immediately (a PIN should not sit in the
 * address bar, or get bookmarked), which means a second mount would find
 * nothing and fall back to the manual form. React does exactly that in
 * development, and so does a fast refresh. Keeping the claim here makes the
 * flow survive a remount instead of depending on not having one.
 */
let claimedInvite: HashInvite | null | undefined;
let pairingAttempt: Promise<string> | null = null;

function claimInvite() {
  if (claimedInvite === undefined) {
    claimedInvite = readInviteFromHash();
    clearHash();
  }
  return claimedInvite;
}

function pairOnce(deviceId: string, pin: string) {
  pairingAttempt ??= pairWithDevice(deviceId, pin, browserLabel()).then((r) => r.token);
  return pairingAttempt;
}

/** Formats free typing into ORB-XXXX-XXXX as the user goes. */
function formatDeviceId(raw: string) {
  const clean = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^ORB/, "")
    .slice(0, 8);
  if (!clean) return "ORB-";
  if (clean.length <= 4) return `ORB-${clean}`;
  return `ORB-${clean.slice(0, 4)}-${clean.slice(4)}`;
}

type Phase = "checking" | "joining" | "joined" | "manual";

export default function ConnectPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("checking");
  const [pcName, setPcName] = useState("");
  const [deviceId, setDeviceId] = useState("ORB-");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Bumped when a new invitation arrives in the fragment without a page load.
  const [inviteTick, setInviteTick] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const idReady = /^ORB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(deviceId);
  const pin = digits.join("");

  const finish = useCallback(
    (id: string, token: string) => {
      storePairing(id, token);
      setPhase("joined");
      // Long enough to read as "done", short enough not to feel like a wait.
      setTimeout(() => router.replace("/pc"), reduceMotion ? 0 : 650);
    },
    [reduceMotion, router],
  );

  /*
   * Orbit hands this page everything it needs in the URL fragment: the PC opens
   * `#d=<id>&p=<pin>` when the exe is run, and a QR code from an already-paired
   * phone carries `#k=<resume key>`. Either way nothing is typed here.
   *
   * Fragments are never sent to a server, so the PIN and the token stay on the
   * device even though they travel in a link.
   */
  /*
   * A link dropped onto the page while it is already open changes only the
   * fragment, which is a same-document navigation: nothing remounts and the
   * effect below would never see it.
   */
  useEffect(() => {
    const onHashChange = () => {
      if (!window.location.hash) return;
      claimedInvite = undefined;
      pairingAttempt = null;
      setError("");
      setPhase("checking");
      setInviteTick((tick) => tick + 1);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const invite = claimInvite();

    if (!invite) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("manual");
      return;
    }

    if (invite.kind === "resume") {
      claimedInvite = null;
      finish(invite.deviceId, invite.token);
      return;
    }

    setPhase("joining");
    setPcName(invite.name);
    setDeviceId(invite.deviceId);

    let cancelled = false;
    pairOnce(invite.deviceId, invite.pin)
      .then((token) => {
        claimedInvite = null;
        if (!cancelled) finish(invite.deviceId, token);
      })
      .catch((err: unknown) => {
        // Let a manual attempt start from a clean slate.
        claimedInvite = null;
        pairingAttempt = null;
        if (cancelled) return;
        // Fall back to the form with the ID already filled in, rather than
        // leaving the page stuck on a spinner.
        setError(err instanceof Error ? err.message : "Pairing failed");
        setPhase("manual");
      });

    return () => {
      cancelled = true;
    };
  }, [finish, inviteTick]);

  async function submit(finalPin: string) {
    if (!idReady || finalPin.length !== 6 || busy) return;

    setBusy(true);
    setError("");
    try {
      const { token } = await pairWithDevice(deviceId, finalPin, browserLabel());
      finish(deviceId, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
      setDigits(Array(6).fill(""));
      boxes.current[0]?.focus();
      setBusy(false);
    }
  }

  function setDigit(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 5) boxes.current[index + 1]?.focus();
    const joined = next.join("");
    if (joined.length === 6 && !joined.includes("")) submit(joined);
  }

  function onPaste(e: React.ClipboardEvent) {
    const nums = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!nums) return;
    e.preventDefault();
    const next = Array(6).fill("");
    nums.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    if (nums.length === 6) submit(nums);
    else boxes.current[nums.length]?.focus();
  }

  const fade = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: ENTER,
      };

  return (
    <>
      <SiteNav />

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-[420px]">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "checking" || phase === "joining" || phase === "joined" ? (
              <motion.div key="auto" {...fade} className="text-center">
                <Handshake done={phase === "joined"} />

                <h1 className="display-md mt-7">
                  {phase === "joined" ? "Connected" : "Connecting…"}
                </h1>
                <p className="lede mt-3 text-[16px]">
                  {phase === "joined"
                    ? `${pcName || "Your PC"} is paired with this device. You won't need a code again.`
                    : pcName
                      ? `Pairing with ${pcName}. Nothing to type.`
                      : "One moment."}
                </p>
              </motion.div>
            ) : (
              <motion.div key="manual" {...fade}>
                <div className="text-center">
                  <OrbitMark className="mx-auto size-10" />
                  <h1 className="display-md mt-5">Connect your PC</h1>
                  <p className="lede mt-3 text-[16px]">
                    Run Orbit on your computer and it connects this browser on its own.
                    Enter the two values by hand if you prefer.
                  </p>
                </div>

                <form
                  className="mt-9 space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(pin);
                  }}
                >
                  <div>
                    <label
                      htmlFor="deviceId"
                      className="mb-2 block text-[13px] font-medium"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      Device ID
                    </label>
                    <input
                      id="deviceId"
                      value={deviceId}
                      onChange={(e) => setDeviceId(formatDeviceId(e.target.value))}
                      placeholder="ORB-4F2A-91C7"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={busy}
                      className="tabular w-full rounded-[12px] border px-4 py-3 text-[19px] font-medium tracking-[0.02em] outline-none transition-colors"
                      style={{
                        background: "var(--bg-elevated)",
                        borderColor: idReady ? "var(--accent)" : "var(--separator)",
                        color: "var(--fg)",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-[13px] font-medium"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      Pairing PIN
                    </label>
                    <div className="flex gap-2">
                      {digits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            boxes.current[i] = el;
                          }}
                          value={d}
                          onChange={(e) => setDigit(i, e.target.value)}
                          onPaste={onPaste}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digits[i] && i > 0) {
                              e.preventDefault();
                              const next = [...digits];
                              next[i - 1] = "";
                              setDigits(next);
                              boxes.current[i - 1]?.focus();
                            }
                          }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          disabled={busy}
                          aria-label={`PIN digit ${i + 1}`}
                          // min-w-0 matters: a flex item will not shrink below an
                          // input's intrinsic size without it, so the row would
                          // overflow its container.
                          className="tabular h-[58px] w-full min-w-0 flex-1 rounded-[12px] border text-center text-[22px] font-medium outline-none transition-colors"
                          style={{
                            background: "var(--bg-elevated)",
                            borderColor: d ? "var(--accent)" : "var(--separator)",
                            color: "var(--fg)",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {error && (
                    <motion.p
                      role="alert"
                      initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={EXIT}
                      className="rounded-[12px] px-4 py-3 text-[15px]"
                      style={{
                        color: "var(--danger)",
                        background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                      }}
                    >
                      {error}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={!idReady || pin.length !== 6 || busy}
                    className="btn btn-primary w-full"
                  >
                    {busy ? <Spinner className="size-5" /> : "Connect"}
                  </button>
                </form>

                <p
                  className="mt-8 text-center text-[13px] leading-relaxed"
                  style={{ color: "var(--fg-tertiary)" }}
                >
                  Don&apos;t have Orbit on your PC yet?{" "}
                  <Link href="/#get" className="underline" style={{ color: "var(--link)" }}>
                    Download it
                  </Link>
                  .
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

/**
 * The waiting state: the Orbit mark with a ring that breathes while the PC is
 * being reached, replaced by a tick the moment it answers.
 */
function Handshake({ done }: { done: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto grid size-[84px] place-items-center">
      {!done && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: "var(--accent)" }}
          initial={{ opacity: 0.5, scale: 0.82 }}
          animate={{ opacity: [0.5, 0, 0.5], scale: [0.82, 1.08, 0.82] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div
        className="grid size-[60px] place-items-center rounded-full"
        style={{
          background: done ? "var(--success)" : "var(--bg-secondary)",
          color: done ? "#fff" : "var(--accent)",
          transition: "background-color 0.3s ease, color 0.3s ease",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span
              key="tick"
              initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
              animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
            >
              <Check className="size-7" strokeWidth={2.4} />
            </motion.span>
          ) : (
            <motion.span
              key="mark"
              exit={reduceMotion ? undefined : { scale: 0.7, opacity: 0 }}
              transition={EXIT}
            >
              <OrbitMark className="size-8" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
