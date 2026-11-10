import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { OrbitMark } from "@/components/icons";

export default function LoginPage() {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <section className="glow-card w-full max-w-[440px] rounded-[26px] p-7 sm:p-9">
          <OrbitMark className="mx-auto size-11" />
          <div className="mt-5 text-center">
            <p className="eyebrow">Your Orbit account</p>
            <h1 className="display-md mt-2">Sign in to Orbit.</h1>
            <p className="mt-3 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
              Manage your devices, plan, and account from one place.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            <button type="button" disabled className="btn btn-secondary w-full">Continue with Google</button>
            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1" style={{ background: "var(--separator)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-tertiary)" }}>or email</span>
              <span className="h-px flex-1" style={{ background: "var(--separator)" }} />
            </div>
            <label className="block text-[13px] font-medium" htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" disabled className="w-full rounded-xl border px-4 py-3 text-[15px] outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--separator)", color: "var(--fg)" }} />
            <label className="block pt-1 text-[13px] font-medium" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" placeholder="Your password" disabled className="w-full rounded-xl border px-4 py-3 text-[15px] outline-none" style={{ background: "var(--bg-elevated)", borderColor: "var(--separator)", color: "var(--fg)" }} />
            <button type="button" disabled className="btn btn-primary w-full">Sign in</button>
          </div>
          <div className="mt-6 rounded-xl p-4 text-center text-[13px] leading-relaxed" style={{ background: "var(--bg-secondary)", color: "var(--fg-secondary)" }}>
            Free account sign-in is being prepared. You can still pair and use Orbit without an account.
          </div>
          <p className="mt-6 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
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
