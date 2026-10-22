export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export const STATUS_TONE: Record<string, "neutral" | "accent" | "good" | "critical"> = {
  pending: "neutral",
  processing: "accent",
  completed: "good",
  failed: "critical",
};
