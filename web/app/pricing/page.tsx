"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site-chrome";
import { Reveal } from "@/components/motion";

type Billing = "monthly" | "yearly";

const plans = [
  {
    name: "Free",
    description: "Everything you need to get started with your own PC.",
    monthly: 0,
    yearly: 0,
    note: "Free forever",
    featured: false,
    features: [
      "1 paired PC",
      "Launch and manage installed apps",
      "See and control open windows",
      "Volume and media controls",
      "Keyboard shortcuts and power actions",
      "Secure QR-based device pairing",
    ],
  },
  {
    name: "Pro",
    description: "For people who use their PC from everywhere.",
    monthly: 99,
    yearly: 999,
    note: "For your personal setup",
    featured: true,
    features: [
      "Up to 3 paired PCs",
      "Everything in Free",
      "Switch between saved PCs",
      "Custom quick-action presets",
      "Advanced app favourites and shortcuts",
      "Extended device activity history",
      "Priority support",
    ],
    roadmap: [
      "Smart reconnect and connection recovery",
      "Device health alerts and status insights",
      "Saved multi-step workflows",
      "Detailed remote session timeline",
    ],
  },
  {
    name: "Business",
    description: "One simple control hub for your team's computers.",
    monthly: 299,
    yearly: 2999,
    note: "For small teams",
    featured: false,
    features: [
      "Up to 10 managed PCs",
      "Everything in Pro",
      "Up to 5 team members",
      "Shared device groups",
      "Role-based access controls",
      "Centralised device overview",
      "Team activity and audit history",
    ],
    roadmap: [
      "Invite teammates and manage seats",
      "Granular team roles and permissions",
      "Bulk device actions and fleet controls",
      "Shared workflow and quick-action library",
      "Exportable team activity reports",
    ],
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <>
      <SiteNav />
      <main className="flex-1 px-5 pb-20 pt-14 sm:pt-20">
        <section className="mx-auto max-w-[1040px]">
          <Reveal className="mx-auto max-w-[700px] text-center">
            <p className="eyebrow mb-3">Simple plans. More control.</p>
            <h1 className="display-xl hero-glow-title">Your PC, on your terms.</h1>
            <p className="lede mx-auto mt-5 max-w-[570px]">
              Start free. Upgrade when you need more devices, more control, or a better way to manage your team's PCs.
            </p>
            <div className="mt-8 inline-flex rounded-full border p-1" style={{ background: "var(--bg-secondary)", borderColor: "var(--separator-soft)" }}>
              <button type="button" onClick={() => setBilling("monthly")} aria-pressed={billing === "monthly"} className="rounded-full px-5 py-2 text-sm font-semibold transition-all" style={{ background: billing === "monthly" ? "var(--bg-elevated)" : "transparent", color: billing === "monthly" ? "var(--fg)" : "var(--fg-secondary)", boxShadow: billing === "monthly" ? "var(--shadow-card)" : "none" }}>
                Monthly
              </button>
              <button type="button" onClick={() => setBilling("yearly")} aria-pressed={billing === "yearly"} className="rounded-full px-5 py-2 text-sm font-semibold transition-all" style={{ background: billing === "yearly" ? "var(--bg-elevated)" : "transparent", color: billing === "yearly" ? "var(--fg)" : "var(--fg-secondary)", boxShadow: billing === "yearly" ? "var(--shadow-card)" : "none" }}>
                Yearly <span className="ml-1 text-[11px]" style={{ color: "var(--success)" }}>Save ~2 months</span>
              </button>
            </div>
          </Reveal>

          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3">
            {plans.map((plan, index) => {
              const price = billing === "monthly" ? plan.monthly : plan.yearly;
              return (
                <Reveal key={plan.name} delay={index * 0.06}>
                  <article className="glow-card relative flex h-full flex-col rounded-[24px] p-6 sm:p-7" style={plan.featured ? { borderColor: "var(--accent)", boxShadow: "var(--shadow-card), 0 0 36px color-mix(in srgb, var(--accent) 15%, transparent)" } : undefined}>
                    {plan.featured && <span className="mb-4 inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))", color: "var(--accent)" }}>Most popular</span>}
                    <h2 className="text-[23px] font-semibold tracking-tight">{plan.name}</h2>
                    <p className="mt-2 min-h-[48px] text-[14px]" style={{ color: "var(--fg-secondary)" }}>{plan.description}</p>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="text-[42px] font-semibold leading-none tracking-[-0.05em] tabular">₹{price}</span>
                      {price > 0 && <span className="pb-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>/{billing === "monthly" ? "month" : "year"}</span>}
                    </div>
                    <p className="mt-2 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                      {price === 0 ? plan.note : billing === "yearly" ? ("₹" + Math.round(price / 12) + " per month, billed yearly") : "Billed monthly"}
                    </p>
                    <div className="my-6 h-px" style={{ background: "var(--separator-soft)" }} />
                    <p className="mb-4 text-[13px] font-semibold">What's included</p>
                    <ul className="flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2.5 text-[13px] leading-relaxed">
                          <span className="mt-[2px] font-bold" style={{ color: "var(--success)" }}>✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.roadmap && (
                      <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--separator-soft)", background: "var(--bg-secondary)" }}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--fg-secondary)" }}>On the roadmap</p>
                          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))", color: "var(--accent)" }}>Coming soon</span>
                        </div>
                        <ul className="space-y-2">
                          {plan.roadmap.map((feature) => (
                            <li key={feature} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                              <span style={{ color: "var(--accent)" }}>✦</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {plan.name === "Free" ? (
                      <Link href="/#get" className="btn btn-secondary mt-8 w-full">Get started free</Link>
                    ) : (
                      <button type="button" disabled className="btn btn-primary mt-8 w-full">Coming soon</button>
                    )}
                  </article>
                </Reveal>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-[720px] text-center text-[12px] leading-relaxed" style={{ color: "var(--fg-tertiary)" }}>
            Pro and Business are preview plans. Paid checkout and some advanced features are not active yet. We’ll enable subscriptions only after the features and account system are ready.
          </p>
        </section>

        <section className="mx-auto mt-20 max-w-[900px] rounded-[24px] border p-7 text-center sm:p-10" style={{ background: "var(--bg-secondary)", borderColor: "var(--separator-soft)" }}>
          <p className="eyebrow">Made for real workflows</p>
          <h2 className="display-lg mt-3">One PC or a whole team.</h2>
          <p className="lede mx-auto mt-4 max-w-[590px] text-[16px]">
            Keep your everyday controls simple, then add more devices and team tools as your setup grows.
          </p>
          <Link href="/login" className="btn btn-secondary mt-7">Explore your Orbit account</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
