import Link from "next/link";
import { OrbitMark } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/** Frosted 48px bar, Apple's proportions: small type, wide tracking, thin rule. */
export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150"
      style={{ background: "var(--nav-bg)", borderColor: "var(--separator-soft)" }}
    >
      <nav className="mx-auto flex h-12 max-w-[980px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2" aria-label="Orbit home">
          <OrbitMark className="size-[22px]" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Orbit</span>
        </Link>

        <div className="flex items-center gap-4 text-[12px] sm:gap-6">
          <a href="#how" className="hidden hover:opacity-60 sm:inline">
            How it works
          </a>
          <a href="#security" className="hidden hover:opacity-60 sm:inline">
            Security
          </a>
          <a href="#get" className="hidden hover:opacity-60 sm:inline">
            Download
          </a>
          <ThemeToggle />
          <Link
            href="/pc"
            className="rounded-full px-3 py-1 font-medium text-white"
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
      className="border-t px-5 py-10 text-[12px]"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--separator-soft)" }}
    >
      <div className="mx-auto max-w-[980px]">
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <div className="min-w-[150px]">
            <p className="mb-2 font-semibold">Orbit</p>
            <ul className="space-y-1.5" style={{ color: "var(--fg-secondary)" }}>
              <li>
                <a href="#how" className="hover:underline">
                  How it works
                </a>
              </li>
              <li>
                <a href="#get" className="hover:underline">
                  Download the agent
                </a>
              </li>
              <li>
                <Link href="/connect" className="hover:underline">
                  Connect a PC
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-[150px]">
            <p className="mb-2 font-semibold">Privacy</p>
            <ul className="space-y-1.5" style={{ color: "var(--fg-secondary)" }}>
              <li>
                <a href="#security" className="hover:underline">
                  How pairing works
                </a>
              </li>
              <li>
                <a href="#security" className="hover:underline">
                  What Orbit can access
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
