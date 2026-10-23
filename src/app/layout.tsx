import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import { PostHogProvider } from "@/lib/posthog-provider";
import "./globals.css";

// DESIGN.md "Typography": Archivo (with its width axis) for everything the
// product says, Newsreader only for what people said in a meeting.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "ScopeLens",
  description:
    "Reads meeting transcripts, pulls out blockers, risks and decisions, and tracks the ones that keep coming back.",
};

// Runs before first paint so a light-theme visitor never sees a dark flash.
// Dark is the default identity; only an explicit choice overrides it.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${archivo.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
