import { describe, expect, it } from "vitest";
import { findEvidence, keywords, splitTranscript } from "../src/lib/evidence";

// Phase 9 transcript evidence — pure lexical matching, no database or AI.

const TRANSCRIPT = [
  "Ana (PM): The goal for sprint 14 is the checkout redesign.",
  "Bruno (Eng): The design handoff for the new checkout page is still pending from the design team, so we can't start the UI.",
  "Carla (Eng): I'll follow up with design today.",
  "Bruno (Eng): We're also blocked on the payments team delivering the new webhook contract.",
  "Diego (Tech lead): Then let's not rush it. Move the checkout redesign to next sprint.",
].join("\n");

describe("keywords", () => {
  it("drops stopwords and short words, folds accents and stems by prefix", () => {
    const words = keywords("The deployment é crítico for the deploys");
    expect(words.has("the")).toBe(false);
    expect(words.has("criti")).toBe(true);
    // "deployment" and "deploys" collapse to the same stem.
    expect(words.has("deplo")).toBe(true);
    expect(words.size).toBe(2);
  });
});

describe("splitTranscript", () => {
  it("splits on lines and drops blanks", () => {
    expect(splitTranscript("a line\n\n  \nanother line")).toEqual(["a line", "another line"]);
  });

  it("splits an overlong single line into sentences", () => {
    const long = `${"Word ".repeat(90).trim()}. Second sentence here.`;
    expect(splitTranscript(long)).toHaveLength(2);
  });
});

describe("findEvidence", () => {
  const segments = splitTranscript(TRANSCRIPT);

  it("finds the line a paraphrased finding came from", () => {
    const evidence = findEvidence(
      segments,
      "Design handoff for the new checkout page is still pending from the design team."
    );
    expect(evidence?.lineIndexes).toEqual([1]);
  });

  it("matches across rewording", () => {
    const evidence = findEvidence(
      segments,
      "Checkout redesign is blocked on the payments team delivering the webhook contract."
    );
    expect(evidence?.lineIndexes).toContain(3);
  });

  it("returns null rather than a weak, misleading quote", () => {
    expect(findEvidence(segments, "Database migration failed in staging overnight.")).toBeNull();
  });

  it("returns null for a description with no usable keywords", () => {
    expect(findEvidence(segments, "the and for")).toBeNull();
  });
});
