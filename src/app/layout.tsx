import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { getSessionUser } from "@/lib/auth/session";
import "@/styles/globals.scss";

// Ampera brand fonts (same files as amperatech.ai).
const switzer = localFont({ src: "./fonts/Switzer-Variable.woff2", variable: "--font-switzer", weight: "100 900" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", preload: false });

export const metadata: Metadata = {
  title: "Ampera: Meta messaging demo",
  description: "WhatsApp, Instagram and Messenger in one AI-assisted workspace. Demo with sample data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Applies the saved light/dark choice before the first paint, so the page
// never flashes the wrong theme. "system" (or nothing saved) follows the OS.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="en" className={`${switzer.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider initialUser={user}>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
