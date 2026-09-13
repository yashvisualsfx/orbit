"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Close } from "./icons";
import { EXIT } from "./motion";

/**
 * An iOS-style bottom sheet: rises from the edge it came from, dims what is
 * behind it, and closes on Escape, on a tap outside, or on a downward drag.
 *
 * Focus moves into the sheet on open and returns to whatever opened it on close,
 * so a keyboard or screen reader is not left behind in the page underneath.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll while a sheet is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={EXIT}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative w-full max-w-[420px] outline-none"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 360, damping: 34, mass: 0.9 }
            }
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              // Either a decisive flick or a long pull closes it.
              if (info.offset.y > 120 || info.velocity.y > 650) onClose();
            }}
          >
            <div
              className="relative rounded-t-[22px] px-5 pb-5 pt-4 sm:rounded-[22px]"
              style={{
                background: "var(--bg-elevated)",
                boxShadow: "var(--shadow-lift)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
              }}
            >
              <div
                className="mx-auto mb-3 h-[5px] w-[38px] rounded-full sm:hidden"
                style={{ background: "var(--separator)" }}
                aria-hidden
              />

              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[19px] font-semibold tracking-[-0.015em]">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-92"
                  style={{ background: "var(--bg-tertiary)", color: "var(--fg-secondary)" }}
                >
                  <Close className="size-[18px]" />
                </button>
              </div>

              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
