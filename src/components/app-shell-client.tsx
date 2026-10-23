"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/ui";

// Below `lg` the sidebar becomes a slide-over panel behind a top bar. The
// panel's content is the same server-rendered sidebar, passed as children.
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // Close on navigation — adjusting state during render when the location
  // changes (https://react.dev/learn/you-might-not-need-an-effect), the same
  // pattern status-badge.tsx uses for its prop resync.
  const location = `${pathname}?${search}`;
  const [prevLocation, setPrevLocation] = useState(location);
  if (location !== prevLocation) {
    setPrevLocation(location);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
        <Link href="/" aria-label="ScopeLens home">
          <Wordmark />
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(true)}
          className="-mr-2 flex size-11 items-center justify-center rounded text-foreground hover:bg-surface-2"
        >
          <span className="sr-only">Open menu</span>
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 6h14M3 10h14M3 14h9" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            id="mobile-nav"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col border-l border-border bg-surface motion-safe:animate-[rise_0.2s_ease-out]"
          >
            <div className="flex h-14 shrink-0 items-center justify-end border-b border-border px-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 flex size-11 items-center justify-center rounded text-foreground hover:bg-surface-2"
              >
                <span className="sr-only">Close menu</span>
                <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

type Theme = "dark" | "light";

// The theme lives on <html data-theme> (set before paint in layout.tsx);
// reading it as an external store keeps server and client renders agreeing.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private mode / blocked storage: the choice just lasts this page view.
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  return (
    <div role="group" aria-label="Theme" className="flex rounded border border-border p-0.5">
      {(["dark", "light"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => setTheme(option)}
          className={`flex size-7 items-center justify-center rounded-sm transition-colors ${
            theme === option ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          <span className="sr-only">{option === "dark" ? "Dark theme" : "Light theme"}</span>
          {option === "dark" ? (
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" />
            </svg>
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
