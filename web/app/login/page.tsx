"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup" | "forgot" | "reset";
type PlanChoice = "free" | "pro" | "business";

const inputStyle = {
  background: "var(--bg-elevated)",
  borderColor: "var(--separator)",
  color: "var(--fg)",
};

const planChoices: {
  id: PlanChoice;
  name: string;
  price: string;
  description: string;
  tag?: string;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    description: "Start with the essential Orbit controls.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹99 / month",
    description: "A preview of advanced personal features.",
    tag: "Personal",
  },
  {
    id: "business",
    name: "Business",
    price: "₹299 / month",
    description: "A preview of shared team and device tools.",
    tag: "Teams",
  },
];

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;

    if (new URLSearchParams(window.location.search).get("mode") === "reset") {
      setMode("reset");
    }

    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    const profileName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "";
    setName(profileName);
    const savedPlan = user.user_metadata?.orbit_selected_plan;
    if (savedPlan === "free" || savedPlan === "pro" || savedPlan === "business") {
      setSelectedPlan(savedPlan);
    }
  }, [user]);

  function switchMode(next: AuthMode) {
    setError("");
    setMessage("");
    setMode(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured yet. Add the project URL and publishable key to the environment variables.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const cleanName = name.trim();
        if (!cleanName) throw new Error("Please enter your name.");
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: { full_name: cleanName, name: cleanName },
          },
        });
        if (authError) throw authError;
        if (data.session) {
          setUser(data.session.user);
          setMessage("");
        } else {
          setMessage("Account created. Check your inbox and confirm your email. You can choose your Orbit plan after signing in.");
        }
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login?mode=reset`,
        });
        if (authError) throw authError;
        setMessage("If an account exists for this email, a password reset link is on its way.");
      } else if (mode === "reset") {
        const { data, error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setUser(data.user);
        setMessage("Password updated.");
        setMode("signin");
        setPassword("");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        setUser(data.user);
        setMessage("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setError("Supabase is not configured yet. Add the project URL and publishable key first.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    if (!supabase || !user) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please enter your name to continue.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          name: cleanName,
          orbit_selected_plan: selectedPlan,
          orbit_onboarding_completed: true,
        },
      });
      if (updateError) throw updateError;
      setUser(data.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t save your choices. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setLoading(true);
    const { error: authError } = await supabase.auth.signOut();
    setLoading(false);
    if (authError) setError(authError.message);
    else {
      setUser(null);
      setMessage("You’ve signed out.");
    }
  }

  const onboardingRequired = Boolean(user && user.user_metadata?.orbit_onboarding_completed !== true);
  const title = mode === "signup" ? "Create your account." :
    mode === "forgot" ? "Reset your password." :
    mode === "reset" ? "Choose a new password." : "Welcome back.";

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:py-16">
        <style jsx global>{`
          @keyframes orbitWelcomeFade {
            from { opacity: 0; transform: translateY(18px) scale(.985); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .orbit-welcome-fade { animation: orbitWelcomeFade .85s cubic-bezier(.2,.75,.25,1) both; }
          @media (prefers-reduced-motion: reduce) {
            .orbit-welcome-fade { animation: none; }
          }
        `}</style>

        {onboardingRequired && user ? (
          <section className="orbit-welcome-fade glow-card w-full max-w-[760px] rounded-[28px] p-6 sm:p-10">
            <div className="text-center">
              <OrbitMark className="mx-auto size-12" />
              <p className="eyebrow mt-6">Your next move starts here</p>
              <h1 className="display-xl mt-3">Welcome to Orbit</h1>
              <p className="mt-3 text-lg sm:text-xl" style={{ color: "var(--fg-secondary)" }}>
                Great to have you here, <strong style={{ color: "var(--fg)" }}>{name || "there"}</strong>.
              </p>
              <p className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
                First, choose the plan that feels right. You can keep using Free and revisit your choice later.
              </p>
            </div>

            <div className="mt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">Choose your plan</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--fg-secondary)" }}>Select one to continue.</p>
                </div>
                <Link href="/pricing" className="text-xs font-semibold" style={{ color: "var(--link)" }}>Compare plans →</Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {planChoices.map((plan) => {
                  const active = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedPlan(plan.id)}
                      className="rounded-2xl border p-4 text-left transition-all"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--separator)",
                        background: active ? "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" : "var(--bg-secondary)",
                        boxShadow: active ? "0 0 0 1px var(--accent)" : "none",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">{plan.name}</span>
                        {active ? (
                          <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>Selected ✓</span>
                        ) : plan.tag ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-tertiary)" }}>{plan.tag}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">{plan.price}</p>
                      <p className="mt-2 min-h-[38px] text-xs leading-relaxed" style={{ color: "var(--fg-secondary)" }}>{plan.description}</p>
                      {plan.id !== "free" && (
                        <p className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
                          Preview only · paid activation coming later
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-xl p-3 text-xs leading-relaxed" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>
              Choosing Pro or Business here only saves your preference. Paid checkout, billing, and paid access are not active yet. No payment will be taken.
            </div>

            {error && <p role="alert" className="mt-5 rounded-xl p-3 text-[13px]" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--bg-secondary))", color: "var(--fg)" }}>{error}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={signOut} disabled={loading} className="text-sm font-semibold" style={{ color: "var(--fg-secondary)" }}>
                Sign out
              </button>
              <button type="button" onClick={completeOnboarding} disabled={loading} className="btn btn-primary w-full sm:w-auto">
                {loading ? "Saving your Orbit…" : "Continue to Orbit"}
              </button>
            </div>
          </section>
        ) : user ? (
          <section className="orbit-welcome-fade glow-card w-full max-w-[500px] rounded-[26px] p-7 text-center sm:p-9">
            <OrbitMark className="mx-auto size-12" />
            <p className="eyebrow mt-6">Account ready</p>
            <h1 className="display-lg mt-3">You’re all set, {name || "welcome"}.</h1>
            <p className="mt-3 text-sm" style={{ color: "var(--fg-secondary)" }}>
              Signed in as <strong style={{ color: "var(--fg)" }}>{user.email}</strong>
            </p>
            <div className="mt-6 rounded-xl p-4 text-left" style={{ background: "var(--bg-secondary)" }}>
              <p className="text-xs" style={{ color: "var(--fg-secondary)" }}>Your selected plan</p>
              <p className="mt-1 text-lg font-semibold capitalize">{(user.user_metadata?.orbit_selected_plan as string) || "Free"}</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Link href="/download" className="btn btn-primary w-full">Download Orbit</Link>
              <Link href="/connect" className="btn btn-secondary w-full">Connect a PC</Link>
              <Link href="/pc" className="btn btn-secondary w-full">Open Orbit</Link>
            </div>
            <button type="button" onClick={signOut} disabled={loading} className="mt-6 text-xs font-semibold" style={{ color: "var(--fg-secondary)" }}>
              {loading ? "Please wait…" : "Sign out"}
            </button>
          </section>
        ) : (
          <section className="glow-card w-full max-w-[460px] rounded-[26px] p-7 sm:p-9">
            <OrbitMark className="mx-auto size-11" />
            <div className="mt-5 text-center">
              <p className="eyebrow">Your Orbit account</p>
              <h1 className="display-md mt-2">{title}</h1>
              <p className="mt-3 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
                Manage your devices, plan, and account from one place.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-3">
              {(mode === "signin" || mode === "signup") && (
                <>
                  <button type="button" onClick={signInWithGoogle} disabled={loading} className="btn btn-secondary w-full">
                    Continue with Google
                  </button>
                  <div className="flex items-center gap-3 py-2">
                    <span className="h-px flex-1" style={{ background: "var(--separator)" }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-tertiary)" }}>or email</span>
                    <span className="h-px flex-1" style={{ background: "var(--separator)" }} />
                  </div>
                </>
              )}

              {mode === "signup" && (
                <>
                  <label className="block text-[13px] font-medium" htmlFor="name">Your name</label>
                  <input id="name" type="text" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" className="w-full rounded-xl border px-4 py-3 text-[15px] outline-none" style={inputStyle} />
                </>
              )}

              <label className="block text-[13px] font-medium" htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border px-4 py-3 text-[15px] outline-none" style={inputStyle} />

              {mode !== "forgot" && (
                <>
                  <label className="block pt-1 text-[13px] font-medium" htmlFor="password">
                    {mode === "reset" ? "New password" : "Password"}
                  </label>
                  <input id="password" type="password" autoComplete={mode === "reset" ? "new-password" : mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="w-full rounded-xl border px-4 py-3 text-[15px] outline-none" style={inputStyle} />
                </>
              )}

              {mode === "signin" && (
                <div className="text-right">
                  <button type="button" onClick={() => switchMode("forgot")} className="text-[12px] font-semibold" style={{ color: "var(--link)" }}>Forgot password?</button>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : "Sign in"}
              </button>
            </form>

            {error && <p role="alert" className="mt-5 rounded-xl p-3 text-[13px]" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--bg-secondary))", color: "var(--fg)" }}>{error}</p>}
            {message && <p role="status" className="mt-5 rounded-xl p-3 text-[13px]" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>{message}</p>}

            <p className="mt-6 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
              {mode === "signin" ? <>New to Orbit? <button type="button" onClick={() => switchMode("signup")} className="font-semibold" style={{ color: "var(--link)" }}>Create an account</button></> :
                mode === "signup" ? <>Already have an account? <button type="button" onClick={() => switchMode("signin")} className="font-semibold" style={{ color: "var(--link)" }}>Sign in</button></> :
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold" style={{ color: "var(--link)" }}>Back to sign in</button>}
            </p>

            <p className="mt-5 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
              Just want to connect a PC? <Link href="/connect" className="font-semibold" style={{ color: "var(--link)" }}>Pair a device</Link>
            </p>
            <p className="mt-3 text-center text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              <Link href="/pricing" className="hover:underline">View plans and pricing</Link>
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
