import Link from "next/link";
import { OrbitMark } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/** Clear, comfortable navigation with a prominent Orbit brand. */
export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "var(--nav-bg)", borderColor: "var(--separator-soft)" }}
    >
      <nav className="mx-auto flex h-[76px] max-w-[1080px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Orbit home">
          <OrbitMark className="size-8 sm:size-9" />
          <span className="text-[21px] font-bold tracking-[-0.03em] sm:text-[22px]">Orbit</span>
        </Link>

        <div className="flex items-center gap-3 text-[15px] font-semibold sm:gap-7 sm:text-[15px]">
          <a href="#how" className="hidden transition-opacity hover:opacity-60 sm:inline">
            How it works
          </a>
          <a href="#security" className="hidden transition-opacity hover:opacity-60 sm:inline">
            Security
          </a>
          <a href="#get" className="hidden transition-opacity hover:opacity-60 sm:inline">
            Download
          </a>
          <a
            href="mailto:godoffserver@gmail.com?subject=Orbit%20Support"
            aria-label="Email Orbit support"
            title="Email Orbit support"
            className="inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-[var(--bg-elevated)] sm:h-auto sm:w-auto sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent"
            style={{ borderColor: "var(--separator-soft)" }}
          >
            <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m4 7 8 6 8-6" />
            </svg>
            <span className="hidden sm:inline">Support</span>
          </a>
          <ThemeToggle />
          <Link
            href="/pc"
            className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] sm:px-5"
            style={{ background: "var(--accent)" }}
          >
            Open Orbit
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer
      className="border-t px-5 py-10 text-[13px]"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--separator-soft)" }}
    >
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-wrap gap-x-12 gap-y-7">
          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Orbit</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li>
                <a href="#how" className="hover:underline">How it works</a>
              </li>
              <li>
                <a href="#get" className="hover:underline">Download the agent</a>
              </li>
              <li>
                <Link href="/connect" className="hover:underline">Connect a PC</Link>
              </li>
            </ul>
          </div>

          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Privacy</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li>
                <a href="#security" className="hover:underline">How pairing works</a>
              </li>
              <li>
                <a href="#security" className="hover:underline">What Orbit can access</a>
              </li>
            </ul>
          </div>

          <div className="min-w-[150px]">
            <p className="mb-3 text-[15px] font-semibold">Help</p>
            <ul className="space-y-2" style={{ color: "var(--fg-secondary)" }}>
              <li>
                <a href="mailto:godoffserver@gmail.com?subject=Orbit%20Support" className="hover:underline">
                  Support · godoffserver@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p
          className="mt-8 border-t pt-6 leading-relaxed"
          style={{ color: "var(--fg-tertiary)", borderColor: "var(--separator-soft)" }}
        >
          Orbit runs a small agent on your computer and relays commands through your own
          paired browser. Windows is a trademark of Microsoft Corporation. Orbit is not
          affiliated with Microsoft or Apple.
        </p>
      </div>
    </footer>
  );
}
