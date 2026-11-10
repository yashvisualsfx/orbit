import Link from "next/link";
import { OrbitMark } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/** Clear, comfortable navigation with a little more room for the Orbit brand. */
export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "var(--nav-bg)", borderColor: "var(--separator-soft)" }}
    >
      <nav className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Orbit home">
          <OrbitMark className="size-7" />
          <span className="text-[19px] font-bold tracking-[-0.025em]">Orbit</span>
        </Link>

        <div className="flex items-center gap-3 text-[14px] font-medium sm:gap-6">
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
            className="hidden transition-opacity hover:opacity-60 sm:inline"
          >
            Support
          </a>
          <ThemeToggle />
          <Link
            href="/pc"
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]"
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
