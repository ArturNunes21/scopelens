export const STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  processing: "Analyzing",
  completed: "Analyzed",
  failed: "Failed",
};

// "Analyzed" is the normal state, so it stays quiet (neutral); only the
// states that need attention use the accent (DESIGN.md).
export const STATUS_TONE: Record<string, "neutral" | "accent" | "good" | "critical"> = {
  pending: "neutral",
  processing: "accent",
  completed: "neutral",
  failed: "critical",
};
