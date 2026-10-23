"use client";

import { useId, useRef, useState } from "react";

export type Tab = { key: string; label: string; count: number; content: React.ReactNode };

// Accessible tabs (WAI-ARIA tablist, arrow-key navigation). Every panel is
// server-rendered and kept in the DOM; switching only toggles `hidden`, so
// no data is fetched on click.
export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const id = useId();
  const firstWithItems = tabs.find((tab) => tab.count > 0)?.key ?? tabs[0]?.key;
  const [selected, setSelected] = useState(firstWithItems);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    setSelected(tabs[next].key);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="-mx-4 flex gap-1 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--border)] sm:mx-0 sm:px-0"
      >
        {tabs.map((tab, index) => {
          const isSelected = tab.key === selected;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`${id}-tab-${tab.key}`}
              aria-selected={isSelected}
              aria-controls={`${id}-panel-${tab.key}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isSelected
                  ? "border-accent text-foreground"
                  : "border-transparent text-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`min-w-5 rounded px-1.5 text-center text-xs tabular-nums ${
                  isSelected ? "bg-surface-2 text-foreground" : "text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${id}-panel-${tab.key}`}
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={tab.key !== selected}
          className="pt-2"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
