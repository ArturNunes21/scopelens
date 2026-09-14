import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";
import { withRetries } from "./retry";
import type { FindingForDiagnosis, Diagnosis } from "./diagnosis";

// Stage 3 — Executive synthesis (ARCHITECTURE.md section 4). Highest-quality
// tier — this is the output the user actually reads.
export const SYNTHESIS_MODEL = "claude-opus-5";
// $/1M tokens for SYNTHESIS_MODEL (Opus 5) — used to populate ai_calls.cost_usd.
const INPUT_COST_PER_MTOK = 5.0;
const OUTPUT_COST_PER_MTOK = 25.0;

export const SynthesisSchema = z.object({
  executive_summary: z.string(),
  suggested_actions: z.array(
    z.object({
      description: z.string(),
      priority: z.enum(["low", "medium", "high"]),
    })
  ),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

export type SynthesisResult = {
  data: Synthesis;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

const SYSTEM_PROMPT = `You write the executive summary a busy stakeholder reads instead of the full transcript.

executive_summary: 3-6 sentences, self-contained (no "as discussed above"), covering what happened, what's blocking progress, and the overall trajectory.

suggested_actions: concrete next steps a reader could act on today, each with a priority:
- high: blocks other work or has a near-term deadline.
- medium: important but not urgent.
- low: worth doing, no pressure.
Do not invent an action that isn't grounded in the findings or diagnostic notes given to you.`;

// transcript_summary (ARCHITECTURE.md section 4 Stage 3 contract): a capped
// slice of the raw transcript rather than a full re-send or a separate
// summarization call — Opus is the priciest tier, and Stage 3 already
// receives the structured findings/diagnosis, which carry the substance;
// the transcript here is just supporting color for tone/context.
const TRANSCRIPT_SUMMARY_CHAR_CAP = 6000;

export async function synthesizeMeeting(
  transcript: string,
  findings: FindingForDiagnosis[],
  diagnosticNotes: Diagnosis["notes"]
): Promise<SynthesisResult> {
  const startedAt = Date.now();
  const transcriptSummary = transcript.slice(0, TRANSCRIPT_SUMMARY_CHAR_CAP);

  const response = await withRetries(() =>
    anthropic.messages.parse({
      model: SYNTHESIS_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcript excerpt:\n${transcriptSummary}\n\nFindings:\n${JSON.stringify(
            findings
          )}\n\nDiagnostic notes:\n${JSON.stringify(diagnosticNotes)}`,
        },
      ],
      output_config: { format: zodOutputFormat(SynthesisSchema) },
    })
  );

  if (!response.parsed_output) {
    throw new Error("Claude response did not match the synthesis schema.");
  }

  const latencyMs = Date.now() - startedAt;
  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const costUsd =
    (tokensIn / 1_000_000) * INPUT_COST_PER_MTOK + (tokensOut / 1_000_000) * OUTPUT_COST_PER_MTOK;

  return { data: response.parsed_output, tokensIn, tokensOut, costUsd, latencyMs };
}
