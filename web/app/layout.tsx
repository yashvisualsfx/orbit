import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_SCRIPT, ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Orbit — Your PC. From anywhere.",
  description:
    "Open any app on your computer from your phone. Launch apps, set the volume, close windows and shut down — from the other side of the world.",
  applicationName: "Orbit",
  appleWebApp: {
    capable: true,
    title: "Orbit",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Orbit — Your PC. From anywhere.",
    description:
      "Open any app on your computer from your phone. No port forwarding, no static IP.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Rewritten at runtime once an explicit appearance is chosen, so the browser
  // chrome follows the site rather than the device.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/*
          Applies the saved appearance before the first paint. Without this a
          dark-mode phone flashes white for one frame on every navigation that
          hits the server.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
