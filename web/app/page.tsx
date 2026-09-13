import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { PhoneMock } from "@/components/phone-mock";
import { Reveal, Rise } from "@/components/motion";
import { Bolt, ChevronRight, Download, Globe, Lock, Shield } from "@/components/icons";

export default function Home() {
  return (
    <>
      <SiteNav />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="px-5 pb-4 pt-14 text-center sm:pt-20">
          <div className="mx-auto max-w-[720px]">
            <Rise>
              <p className="eyebrow mb-3">Orbit for Windows</p>
            </Rise>
            <Rise delay={0.05}>
              {/* Broken by hand so the line never splits "From anywhere". */}
              <h1 className="display-xl">
                Your PC.
                <br />
                From anywhere.
              </h1>
            </Rise>
            <Rise delay={0.12}>
              <p className="lede mx-auto mt-5 max-w-[540px] text-balance">
                Tap an app on your phone and it opens on your computer — whether
                you&apos;re in the next room or a different country.
              </p>
            </Rise>

            <Rise delay={0.18}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href="/Orbit.exe" className="btn btn-primary">
                  <Download className="size-[18px]" />
                  Download for Windows
                </a>
                <Link href="/pc" className="btn btn-secondary">
                  Open Orbit
                </Link>
              </div>

              <p className="mt-4 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                One file. No account, no install wizard, no Node.js.
              </p>
            </Rise>
          </div>

          <Rise delay={0.24} className="mt-14 sm:mt-20">
            <PhoneMock />
          </Rise>
        </section>

        {/* --------------------------------------------------- the hard part */}
        <section className="mt-16 px-5 py-20" style={{ background: "var(--bg-secondary)" }}>
          <div className="mx-auto max-w-[980px]">
            <Reveal>
              <h2 className="display-lg max-w-[640px] text-balance">
                No port forwarding. No static IP. Nothing to reconnect.
              </h2>
              <p className="lede mt-5 max-w-[600px]">
                Most remote tools ask you to open ports on your router, then ask you to
                sign in again every time. Orbit asks once. The agent starts with Windows
                and reaches out by itself, so the PC is simply there when you open your
                phone — on college Wi-Fi, a hotspot, or a hotel network.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              <Reveal delay={0.04}>
                <Feature
                  icon={<Globe className="size-6" />}
                  title="Works on any network"
                  body="Outbound connection only. Nothing to configure, and nothing of yours exposed to the internet."
                />
              </Reveal>
              <Reveal delay={0.09}>
                <Feature
                  icon={<Bolt className="size-6" />}
                  title="Always already connected"
                  body="Orbit starts with Windows and your phone remembers the pairing, so there is no code to enter a second time."
                />
              </Reveal>
              <Reveal delay={0.14}>
                <Feature
                  icon={<Shield className="size-6" />}
                  title="Your PC decides"
                  body="Orbit's servers never issue the key that controls your machine. Your PC checks the PIN and signs the token itself."
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ what you get */}
        <section className="px-5 py-20">
          <div className="mx-auto max-w-[980px]">
            <Reveal>
              <h2 className="display-lg text-balance">Everything, one tap away.</h2>
            </Reveal>

            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
              <Detail
                title="Every installed app"
                body="Orbit reads your Start Menu and pulls each app's real Windows icon at full resolution. After Effects, Blender, Steam, your Store apps — all of it, in a grid, searchable."
              />
              <Detail
                title="Open windows"
                body="See what's running with live memory use. Bring a window to the front or close it. Store apps resolve to the real process, so closing one doesn't take three others with it."
              />
              <Detail
                title="Volume and media"
                body="A real Windows volume slider, not a key-press approximation. Play, pause and skip work with anything that responds to media keys."
              />
              <Detail
                title="Keyboard and power"
                body="Type into whatever is focused. Send Enter, Tab, Esc or Alt+F4. Lock, sleep, restart or shut down — with a confirmation and twenty seconds to change your mind."
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section
          id="how"
          className="scroll-mt-14 px-5 py-20"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div className="mx-auto max-w-[980px]">
            <Reveal>
              <h2 className="display-lg text-balance">Set up once. Then never again.</h2>
              <p className="lede mt-5 max-w-[600px]">
                There is no code to type on the PC and none to type on the phone. The
                first run does the pairing; every restart after that reconnects on its
                own.
              </p>
            </Reveal>

            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              <Reveal as="li" delay={0.04}>
                <StepBody
                  n="1"
                  title="Run Orbit.exe"
                  body="Double-click it once. Orbit installs itself for your account, registers itself to start with Windows, and opens your browser already paired."
                />
              </Reveal>
              <Reveal as="li" delay={0.09}>
                <StepBody
                  n="2"
                  title="Scan the code with your phone"
                  body="The page shows a QR code. Point your camera at it and the phone pairs itself — no Device ID, no PIN."
                />
              </Reveal>
              <Reveal as="li" delay={0.14}>
                <StepBody
                  n="3"
                  title="Add it to your home screen"
                  body="Orbit then behaves like an app, and keeps the pairing for good. Turn the PC on and it is simply online."
                />
              </Reveal>
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------- security */}
        <section
          id="security"
          className="scroll-mt-14 px-5 py-20"
          style={{ background: "#000", color: "#f5f5f7" }}
        >
          <div className="mx-auto max-w-[980px]">
            <Reveal className="flex items-start gap-4">
              <Lock className="mt-1 size-7 shrink-0" />
              <div>
                <h2 className="display-lg text-balance">
                  Built so we can&apos;t control your PC.
                </h2>
                <p
                  className="lede mt-5 max-w-[620px]"
                  style={{ color: "rgba(245,245,247,0.65)" }}
                >
                  Pairing is checked on your computer, not on our servers. When you enter
                  your PIN, the request passes through untouched and your PC verifies it,
                  then signs an access token with a secret that never leaves the machine.
                  Every later command is checked against that signature.
                </p>

                <ul className="mt-8 space-y-3 text-[15px]">
                  <SecurityPoint>
                    Eight wrong PINs locks out that device for five minutes.
                  </SecurityPoint>
                  <SecurityPoint>
                    Revoking access rotates the signing secret, so every paired browser is
                    signed out at once.
                  </SecurityPoint>
                  <SecurityPoint>
                    Shutdown and restart wait twenty seconds and can be cancelled.
                  </SecurityPoint>
                  <SecurityPoint>
                    Orbit can&apos;t unlock Windows. The lock screen is designed to refuse
                    exactly that, and we don&apos;t work around it.
                  </SecurityPoint>
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------- download */}
        <section id="get" className="scroll-mt-14 px-5 py-24 text-center">
          <Reveal className="mx-auto max-w-[640px]">
            <h2 className="display-lg text-balance">Put it on your PC.</h2>
            <p className="lede mx-auto mt-5 max-w-[480px]">
              One file, nothing to install alongside it. Windows 10 and 11. The first run
              takes about a minute, most of it indexing your apps.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="/Orbit.exe" className="btn btn-primary">
                <Download className="size-[18px]" />
                Download Orbit.exe
              </a>
              <Link href="/pc" className="link-arrow">
                Already set up? Open Orbit
                <ChevronRight className="size-4" strokeWidth={2.2} />
              </Link>
            </div>

            <p
              className="mx-auto mt-6 max-w-[460px] text-[13px] leading-relaxed"
              style={{ color: "var(--fg-tertiary)" }}
            >
              Orbit isn&apos;t code-signed yet, so Windows may warn about an unknown
              publisher the first time. Choose More info, then Run anyway. Remove it any
              time from Orbit in your Start menu.
            </p>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[18px] p-6"
      style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-card)" }}
    >
      <div style={{ color: "var(--accent)" }}>{icon}</div>
      <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.015em]">{title}</h3>
      <p className="mt-2 text-[15px]" style={{ color: "var(--fg-secondary)" }}>
        {body}
      </p>
    </div>
  );
}

function Detail({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t pt-5" style={{ borderColor: "var(--separator)" }}>
      <h3 className="display-md">{title}</h3>
      <p className="mt-3 text-[16px]" style={{ color: "var(--fg-secondary)" }}>
        {body}
      </p>
    </div>
  );
}

function StepBody({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <>
      <div
        className="grid size-9 place-items-center rounded-full text-[15px] font-semibold"
        style={{ background: "var(--fg)", color: "var(--bg)" }}
      >
        {n}
      </div>
      <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.015em]">{title}</h3>
      <p className="mt-2 text-[15px]" style={{ color: "var(--fg-secondary)" }}>
        {body}
      </p>
    </>
  );
}

function SecurityPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3" style={{ color: "rgba(245,245,247,0.75)" }}>
      <span
        className="mt-[9px] size-[5px] shrink-0 rounded-full"
        style={{ background: "#2997ff" }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}
