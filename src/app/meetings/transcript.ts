const MAX_TRANSCRIPT_CHARS = 50_000;

// Strips WebVTT cue markup (header, cue ids, timestamp lines) down to the
// spoken text (ARCHITECTURE.md 2.2 — only the parsed text is kept, the
// original file is discarded).
function parseVtt(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed === "WEBVTT") return false;
      if (trimmed.includes("-->")) return false;
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export type TranscriptResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function extractTranscript(
  filename: string,
  raw: string
): TranscriptResult {
  const text = filename.toLowerCase().endsWith(".vtt") ? parseVtt(raw) : raw.trim();

  if (!text) {
    return { ok: false, error: "The file/text has no content to analyze." };
  }
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      error: `Transcript is too long (${text.length.toLocaleString()} characters, max ${MAX_TRANSCRIPT_CHARS.toLocaleString()}).`,
    };
  }

  return { ok: true, text };
}

export { MAX_TRANSCRIPT_CHARS };
