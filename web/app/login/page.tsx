"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup" | "forgot" | "reset";

const inputStyle = {
  background: "var(--bg-elevated)",
  borderColor: "var(--separator)",
  color: "var(--fg)",
};

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
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
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        if (authError) throw authError;
        if (data.session) {
          setUser(data.session.user);
          setMessage("Your Orbit account is ready.");
        } else {
          setMessage("Account created. Check your inbox and confirm your email before signing in.");
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
        setMessage("Password updated. Your Orbit account is ready.");
        setMode("signin");
        setPassword("");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        setUser(data.user);
        setMessage("You’re signed in to Orbit.");
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

  async function signOut() {
    if (!supabase) return;
    setLoading(true);
    const { error: authError } = await supabase.auth.signOut();
    setLoading(false);
    if (authError) setError(authError.message);
    else setMessage("You’ve signed out.");
  }

  const title = mode === "signup" ? "Create your account." :
    mode === "forgot" ? "Reset your password." :
    mode === "reset" ? "Choose a new password." : "Welcome back.";

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <section className="glow-card w-full max-w-[460px] rounded-[26px] p-7 sm:p-9">
          <OrbitMark className="mx-auto size-11" />
          <div className="mt-5 text-center">
            <p className="eyebrow">Your Orbit account</p>
            <h1 className="display-md mt-2">{user ? "You’re in Orbit." : title}</h1>
            <p className="mt-3 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
              {user ? "Your account is signed in on this browser." : "Manage your devices, plan, and account from one place."}
            </p>
          </div>

          {user ? (
            <div className="mt-8 space-y-4 text-center">
              <div className="rounded-xl p-4 text-sm" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>
                Signed in as <strong style={{ color: "var(--fg)" }}>{user.email}</strong>
              </div>
              <button type="button" onClick={signOut} disabled={loading} className="btn btn-primary w-full">
                {loading ? "Please wait…" : "Sign out"}
              </button>
            </div>
          ) : (
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
          )}

          {error && <p role="alert" className="mt-5 rounded-xl p-3 text-[13px]" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--bg-secondary))", color: "var(--fg)" }}>{error}</p>}
          {message && <p role="status" className="mt-5 rounded-xl p-3 text-[13px]" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>{message}</p>}

          {!user && (
            <p className="mt-6 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
              {mode === "signin" ? <>New to Orbit? <button type="button" onClick={() => switchMode("signup")} className="font-semibold" style={{ color: "var(--link)" }}>Create an account</button></> :
                mode === "signup" ? <>Already have an account? <button type="button" onClick={() => switchMode("signin")} className="font-semibold" style={{ color: "var(--link)" }}>Sign in</button></> :
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold" style={{ color: "var(--link)" }}>Back to sign in</button>}
            </p>
          )}

          <p className="mt-5 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
            Just want to connect a PC? <Link href="/connect" className="font-semibold" style={{ color: "var(--link)" }}>Pair a device</Link>
          </p>
          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
            <Link href="/pricing" className="hover:underline">View plans and pricing</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
