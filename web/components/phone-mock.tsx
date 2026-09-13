/*
 * A static rendering of the real Orbit control screen, used as the hero image.
 * Tiles use neutral initials rather than third-party logos, so the mock shows
 * the product without borrowing anyone's brand marks.
 */

const ROW_ONE = [
  { label: "Ae", name: "After Effects", tint: "#00005b", fg: "#9a9aff" },
  { label: "Ps", name: "Photoshop", tint: "#001e36", fg: "#31a8ff" },
  { label: "Pr", name: "Premiere", tint: "#2a0634", fg: "#ea77ff" },
  { label: "Bl", name: "Blender", tint: "#2a2118", fg: "#f5792a" },
];

const ROW_TWO = [
  { label: "Co", name: "VS Code", tint: "#1f2a38", fg: "#75b4ff" },
  { label: "St", name: "Steam", tint: "#16202d", fg: "#c7d5e0" },
  { label: "Sp", name: "Spotify", tint: "#10281a", fg: "#4ee07f" },
  { label: "Fi", name: "Figma", tint: "#2b2412", fg: "#ffd166" },
];

const ROW_THREE = [
  { label: "Di", name: "Discord", tint: "#1e2140", fg: "#8b93f8" },
  { label: "No", name: "Notepad", tint: "#232323", fg: "#dcdcdc" },
  { label: "Ch", name: "Chrome", tint: "#232a32", fg: "#9ec3ff" },
  { label: "Te", name: "Terminal", tint: "#0f2733", fg: "#54b9e8" },
];

function Tile({
  label,
  name,
  tint,
  fg,
}: {
  label: string;
  name: string;
  tint: string;
  fg: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="grid size-[42px] place-items-center rounded-[11px] text-[15px] font-semibold"
        style={{ background: tint, color: fg }}
      >
        {label}
      </div>
      <span className="w-full truncate text-center text-[8.5px] leading-tight text-white/45">
        {name}
      </span>
    </div>
  );
}

export function PhoneMock() {
  return (
    <div
      className="relative mx-auto w-[290px] rounded-[44px] p-[10px] shadow-[0_40px_90px_rgba(0,0,0,0.28)]"
      style={{ background: "#1c1c1e", border: "1px solid #3a3a3c" }}
      aria-hidden
    >
      <div className="overflow-hidden rounded-[35px] bg-black px-4 pb-5 pt-3">
        {/* status bar */}
        <div className="mb-4 flex items-center justify-between text-[11px] text-white/85">
          <span className="tabular font-semibold">9:41</span>
          <div className="h-[18px] w-[72px] rounded-full bg-black" />
          <div className="flex items-center gap-1">
            <div className="h-[9px] w-[16px] rounded-[3px] border border-white/60" />
          </div>
        </div>

        {/* device header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-white">My PC</p>
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <span className="size-[6px] rounded-full" style={{ background: "#30d158" }} />
              Online · 132 apps
            </p>
          </div>
          <div className="size-7 rounded-full bg-white/10" />
        </div>

        {/* search */}
        <div className="mb-4 flex h-8 items-center gap-2 rounded-[9px] bg-white/10 px-2.5">
          <svg className="size-3.5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" strokeLinecap="round" />
          </svg>
          <span className="text-[12px] text-white/35">Search apps</span>
        </div>

        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
          Favourites
        </p>
        <div className="mb-4 grid grid-cols-4 gap-x-2 gap-y-3">
          {ROW_ONE.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>

        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-white/35">
          All apps
        </p>
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {[...ROW_TWO, ...ROW_THREE].map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>

        {/* tab bar */}
        <div className="mt-5 flex items-center justify-around border-t border-white/10 pt-3">
          {["Apps", "Windows", "Remote"].map((t, i) => (
            <span
              key={t}
              className="text-[10px] font-medium"
              style={{ color: i === 0 ? "#2997ff" : "rgba(255,255,255,0.35)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
