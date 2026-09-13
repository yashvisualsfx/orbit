/*
 * One icon family, hand-drawn on a 24px grid with a 1.7 stroke and round caps,
 * so nothing in the product mixes weights or corner styles. Decorative icons
 * are hidden from assistive tech by the components that render them.
 */

type IconProps = {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

function base(className = "size-5", strokeWidth = 1.7, style?: React.CSSProperties) {
  return {
    className,
    style,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export const OrbitMark = ({ className = "size-8" }: IconProps) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
    <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="2" />
    <ellipse
      cx="16"
      cy="16"
      rx="14"
      ry="6.2"
      stroke="currentColor"
      strokeWidth="1.6"
      opacity="0.42"
      transform="rotate(-28 16 16)"
    />
    <circle cx="27.1" cy="10.6" r="2.7" fill="currentColor" />
  </svg>
);

export const Search = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const Close = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ChevronRight = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const ChevronDown = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="m5 9 7 7 7-7" />
  </svg>
);

export const Refresh = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const Grid = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

export const Display = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="2.5" y="4" width="19" height="13" rx="2.2" />
    <path d="M9 21h6" />
  </svg>
);

export const Sliders = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M1.5 14h5M9.5 8h5M17.5 16h5" />
  </svg>
);

export const SpeakerWave = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M11 5 6 9H2.5v6H6l5 4z" />
    <path d="M15.4 8.6a4.8 4.8 0 0 1 0 6.8" />
    <path d="M18.8 5.2a9.6 9.6 0 0 1 0 13.6" />
  </svg>
);

export const SpeakerOff = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M11 5 6 9H2.5v6H6l5 4z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const Play = ({ className = "size-6" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const Pause = ({ className = "size-6" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5h3.2v14H8zM12.8 5H16v14h-3.2z" />
  </svg>
);

export const Backward = ({ className = "size-6" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 5h2.2v14H6zm13 0v14l-9.4-7z" />
  </svg>
);

export const Forward = ({ className = "size-6" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M15.8 5H18v14h-2.2zM5 5l9.4 7L5 19z" />
  </svg>
);

export const Power = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M12 3v9" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  </svg>
);

export const Lock = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export const Moon = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" />
  </svg>
);

export const Bolt = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M13.2 2 4.5 13.4h6.1L10.8 22l8.7-11.4h-6.1z" />
  </svg>
);

export const Shield = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M12 2.5 4.5 5.6v6c0 4.6 3.1 8.7 7.5 9.9 4.4-1.2 7.5-5.3 7.5-9.9v-6z" />
    <path d="m9.2 12 2 2 3.6-3.8" />
  </svg>
);

export const Globe = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M2.8 12h18.4" />
    <path d="M12 2.8c2.3 2.5 3.6 5.7 3.6 9.2s-1.3 6.7-3.6 9.2c-2.3-2.5-3.6-5.7-3.6-9.2S9.7 5.3 12 2.8z" />
  </svg>
);

export const Keyboard = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.2" />
    <path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M8 13.8h8" />
  </svg>
);

export const Star = ({ className = "size-4", filled = false }: IconProps & { filled?: boolean }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m12 3 2.6 5.6 6 .7-4.5 4.2 1.2 6L12 16.6 6.7 19.5l1.2-6L3.4 9.3l6-.7z" />
  </svg>
);

export const Spinner = ({ className = "size-5" }: IconProps) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.22" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const Sun = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.2v2.1M12 19.7v2.1M4.2 12H2.1M21.9 12h-2.1M6.5 6.5 5 5M19 19l-1.5-1.5M17.5 6.5 19 5M5 19l1.5-1.5" />
  </svg>
);

/* Half-filled circle: the system's own mark for "match the device". */
export const Auto = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 3.4a8.6 8.6 0 0 0 0 17.2z" fill="currentColor" stroke="none" />
  </svg>
);

export const QrCode = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="3.2" y="3.2" width="7" height="7" rx="1.6" />
    <rect x="13.8" y="3.2" width="7" height="7" rx="1.6" />
    <rect x="3.2" y="13.8" width="7" height="7" rx="1.6" />
    <path d="M14 14h2.4M20.8 14v2.4M14 18.4v2.4M18 18.2h2.8" />
  </svg>
);

export const Copy = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="9" y="9" width="11.5" height="11.5" rx="3" />
    <path d="M15.2 5.6A2.6 2.6 0 0 0 12.6 3.5H6.1A2.6 2.6 0 0 0 3.5 6.1v6.5a2.6 2.6 0 0 0 2.1 2.6" />
  </svg>
);

export const Check = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="m4.5 12.8 4.8 4.7L19.5 6.8" />
  </svg>
);

export const Phone = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <rect x="6.4" y="2.4" width="11.2" height="19.2" rx="3.2" />
    <path d="M10.6 5.2h2.8" />
  </svg>
);

export const Download = ({ className, strokeWidth, style }: IconProps) => (
  <svg {...base(className, strokeWidth, style)}>
    <path d="M12 3.5v11.8m0 0 4.2-4.2M12 15.3 7.8 11.1" />
    <path d="M4.2 17.2v1.4a2.6 2.6 0 0 0 2.6 2.6h10.4a2.6 2.6 0 0 0 2.6-2.6v-1.4" />
  </svg>
);
