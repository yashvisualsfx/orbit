import type { MetadataRoute } from "next";

/**
 * Installing Orbit to the home screen is not only cosmetic: an installed site
 * keeps its storage, while a plain bookmarked site can have it evicted — which
 * would drop the pairing and ask for a code again.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbit — Your PC. From anywhere.",
    short_name: "Orbit",
    description:
      "Open any app on your computer from your phone. Launch apps, set the volume, close windows and shut down.",
    start_url: "/pc",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/orbit-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/orbit-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
