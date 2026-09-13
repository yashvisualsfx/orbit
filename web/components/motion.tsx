"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";

/*
 * Shared motion tokens. Every animation in the product is built from these, so
 * the whole site moves with one rhythm instead of each component inventing its
 * own timing.
 *
 * The curve is Apple's standard ease-out: content arrives decelerating and never
 * overshoots. Springs are reserved for things the finger is driving.
 */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

export const ENTER: Transition = { duration: 0.55, ease: EASE };
export const EXIT: Transition = { duration: 0.32, ease: EASE };
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34 };

/**
 * Fades a section up as it scrolls into view, once.
 *
 * `delay` staggers siblings by hand where a parent variant would be overkill;
 * keep it under ~0.2s so nothing feels like it is waiting its turn.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduceMotion = useReducedMotion();
  const Tag = motion[as];

  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // A little past the edge, so the animation is finished by the time the
      // element is comfortably on screen rather than starting there.
      viewport={{ once: true, margin: "-8% 0px -8% 0px" }}
      transition={{ ...ENTER, delay }}
    >
      {children}
    </Tag>
  );
}

/** Page-load entrance for above-the-fold content, where there is no scroll cue. */
export function Rise({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTER, delay }}
    >
      {children}
    </motion.div>
  );
}
