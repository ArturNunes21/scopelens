"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

// Phase 9 — export for the pre-meeting brief: copy as Markdown (pastes
// cleanly into Slack, Notion, GitHub, email) or download as a .md file.
export function MarkdownExport({ markdown, filename }: { markdown: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className={buttonClass("primary")}
      >
        {copied ? "Copied" : "Copy as Markdown"}
      </button>
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        }}
        className={buttonClass("secondary")}
      >
        Download .md
      </button>
    </div>
  );
}
