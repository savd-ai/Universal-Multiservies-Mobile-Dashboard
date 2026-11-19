import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Fonts: next/font self-hosts them. Variables are --nf-* so Tailwind's --font-* can point at them without
// referencing themselves.
const display = Space_Grotesk({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--nf-display", display: "swap" });
const serif = Newsreader({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--nf-serif", display: "swap" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--nf-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext", "vietnamese"], weight: ["400", "500"], variable: "--nf-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SAVD Ads Intelligence", template: "%s · SAVD Ads Intelligence" },
  description: "Customizable Google Ads dashboard: monitoring, budget planning, anomaly warnings, plugins and AI campaign ideas.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C0E" },
  ],
};

// Runs before first paint: apply the saved theme (key from the prototype) so there is no flash.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("savd-gads-theme");var d=document.documentElement;if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);d.style.colorScheme=t}else if(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches){d.setAttribute("data-theme","dark");d.style.colorScheme="dark"}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={[display.variable, serif.variable, sans.variable, mono.variable].join(" ")}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
