"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * A QR code drawn as one SVG path.
 *
 * Rendering the modules ourselves rather than dropping in a generated <img>
 * keeps it vector-sharp at any size and lets it take its colours from the theme,
 * so the code stays scannable in both light and dark mode. A white quiet zone is
 * painted behind it either way: cameras need the contrast.
 */
export function Qr({
  value,
  className = "size-full",
  label = "QR code",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const code = useMemo(() => {
    try {
      // Medium correction: enough to survive a fingerprinted phone screen
      // without inflating the module count for a long URL.
      const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
      const size = qr.modules.size;
      const data = qr.modules.data;

      let d = "";
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return { size, d };
    } catch {
      return null;
    }
  }, [value]);

  if (!code) return null;

  const quiet = 2;
  const extent = code.size + quiet * 2;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} rx={1.5} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={code.d} fill="#000000" />
      </g>
    </svg>
  );
}
