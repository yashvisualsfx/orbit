import Link from "next/link";
import { OrbitMark } from "./icons";
import { ThemeToggle } from "./theme-toggle";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150" style={{ background: "var(--nav-bg)", borderColor: "var(--separator-soft)" }}>
      <nav className="mx-auto flex h-[68px] max-w-[1080px] items-center justify-between gap-3 px-4 sm:h-20 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3" aria-label="Orbit home">
          <OrbitMark className="size-8 sm:size-9" />
          <span className="text-[20px] font-bold tracking-[-0.03em] sm:text-[22px]">Orbit</span>
        </Link>

        <div className="hidden items-center gap-6 text-[14px] font-semibold sm:flex sm:text-[15px]">
          <Link href="/#how" className="transition-opacity hover:opacity-60">How it works</Link>
          <Link href="/pricing" className="transition-opacity hover:opacity-60">Pricing</Link>
          <a href="mailto:godoffserver@gmail.com?subject=Orbit%20Support" className="transition-opacity hover:opacity-60">Support</a>
          <Link href="/login" className="rounded-full px-2 py-2 transition-colors hover:text-[var(--accent)]">Sign in</Link>
          <ThemeToggle />
          <Link href="/pc" className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]" style={{ background: "var(--accent)" }}>Open Orbit</Link>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <details className="relative">
            <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full border text-xl" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-elevated)" }} aria-label="Open navigation menu">
              <span aria-hidden>☰</span>
            </summary>
            <div className="absolute right-0 top-12 z-[60] grid min-w-48 gap-1 rounded-2xl border p-2 shadow-xl" style={{ background: "var(--bg-elevated)", borderColor: "var(--separator-soft)" }}>
              <Link className="rounded-xl px-4 py-3 text-sm hover:bg-[var(--bg-secondary)]" href="/#how">How it works</Link>
              <Link className="rounded-xl px-4 py-3 text-sm hover:bg-[var(--bg-secondary)]" href="/pricing">Pricing</Link>
              <a className="rounded-xl px-4 py-3 text-sm hover:bg-[var(--bg-secondary)]" href="mailto:godoffserver@gmail.com?subject=Orbit%20Support">Support</a>
              <Link className="rounded-xl px-4 py-3 text-sm hover:bg-[var(--bg-secondary)]" href="/login">Sign in</Link>
              <Link className="rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: "var(--accent)" }} href="/pc">Open Orbit</Link>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t px-5 py-10 text-[13px]" style={{ background: "var(--bg-secondary)", borderColor: "var(--separator-soft)" }}>
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-wrap gap-x-12 gap-y-7">
          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Orbit</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li><a href="/#how" className="hover:underline">How it works</a></li>
              <li><a href="/#get" className="hover:underline">Download the agent</a></li>
              <li><Link href="/connect" className="hover:underline">Connect a PC</Link></li>
              <li><Link href="/pricing" className="hover:underline">Plans & pricing</Link></li>
            </ul>
          </div>
          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Privacy</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li><a href="/#security" className="hover:underline">How pairing works</a></li>
              <li><a href="/#security" className="hover:underline">What Orbit can access</a></li>
            </ul>
          </div>
          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Help</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li><a href="mailto:godoffserver@gmail.com?subject=Orbit%20Support" className="hover:underline">Support · godoffserver@gmail.com</a></li>
              <li><Link href="/login" className="hover:underline">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t pt-6 leading-relaxed" style={{ color: "var(--fg-tertiary)", borderColor: "var(--separator-soft)" }}>
          Orbit runs a small agent on your computer and relays commands through your own paired browser. Windows is a trademark of Microsoft Corporation. Orbit is not affiliated with Microsoft or Apple.
        </p>
      </div>
    </footer>
  );
}
