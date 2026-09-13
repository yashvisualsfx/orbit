"use client";

import { motion, useReducedMotion } from "motion/react";
import { Auto, Moon, Sun } from "./icons";
import { Theme, useTheme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="size-[15px]" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-[15px]" /> },
  { value: "system", label: "Automatic", icon: <Auto className="size-[15px]" /> },
];

/**
 * Light / Dark / Automatic, as a segmented control rather than a single switch:
 * a two-state toggle cannot express "follow the device", and that is the state
 * most people should be left in.
 *
 * The selected pill is one shared element that slides between segments, so the
 * movement shows which way the selection went instead of blinking.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={`relative inline-flex rounded-full p-[3px] ${className}`}
      style={{ background: "var(--bg-tertiary)" }}
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className="relative grid h-[26px] w-[38px] place-items-center rounded-full transition-colors"
            style={{ color: selected ? "var(--fg)" : "var(--fg-tertiary)" }}
          >
            {selected && (
              <motion.span
                layoutId="theme-pill"
                // The pill is painted behind the glyph, never over it.
                className="absolute inset-0 rounded-full"
                style={{
                  background: "var(--bg-elevated)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }
                }
              />
            )}
            <span className="relative">{option.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
