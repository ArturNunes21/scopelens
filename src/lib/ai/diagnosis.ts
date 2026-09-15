import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";
import { withRetries } from "./retry";

// Stage 2 — Multi-perspective diagnosis (ARCHITECTURE.md section 4). Mid-tier
// model — reasoning across findings, not cheap extraction, but not the final
// user-facing synthesis either.
export const DIAGNOSIS_MODEL = "claude-sonnet-5";
// $/1M tokens for DIAGNOSIS_MODEL (Sonnet 5) — used to populate ai_calls.cost_usd.
const INPUT_COST_PER_MTOK = 2.0;
const OUTPUT_COST_PER_MTOK = 10.0;

// Closed lens list (ARCHITECTURE.md section 4, resolves GAPS.md G14) — never
// invent a fourth at prompt time.
const LENSES = ["contradiction", "continuity", "decision_gap"] as const;

export const DiagnosisSchema = z.object({
  notes: z.array(
    z.object({
      lens: z.enum(LENSES),
      content: z.string(),
      related_finding_ids: z.array(z.string()),
    })
  ),
});

export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export type DiagnosisResult = {
  data: Diagnosis;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

// Shape passed in from pipeline.ts: this meeting's just-extracted findings
// (with their real ids, already assigned before this call) and a capped
// sample of other OPEN findings in the workspace, for the continuity lens.
export type FindingForDiagnosis = {
  id: string;
  finding_type: string;
  description: string;
  owner: string | null;
};

const SYSTEM_PROMPT = `You analyze a meeting's extracted findings through three fixed diagnostic lenses:

- contradiction: participants describing the same thing incompatibly, implying an undisclosed risk.
- continuity: this meeting's findings connected to patterns from prior meetings in the same workspace (only using the prior findings given to you — never invent history).
- decision_gap: decisions that should have been made in this meeting but weren't, blocking downstream work.

Rules:
- Only write a note when the lens genuinely applies — an empty "notes" array for a clean meeting is correct, not a failure.
- content is a concise, self-contained sentence a reader with no other context would understand.
- related_finding_ids must only contain ids that were given to you in the input findings/prior_findings — never invent an id.
- Do not restate a finding's description verbatim; add the cross-cutting insight the lens is for.`;

export async function diagnoseMeeting(
  transcript: string,
  currentFindings: FindingForDiagnosis[],
  priorFindings: FindingForDiagnosis[]
): Promise<DiagnosisResult> {
  const startedAt = Date.now();

  const response = await withRetries(() =>
    anthropic.messages.parse({
      model: DIAGNOSIS_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcript:\n${transcript}\n\nThis meeting's findings:\n${JSON.stringify(
            currentFindings
          )}\n\nPrior open findings from other meetings in this workspace (for the continuity lens):\n${JSON.stringify(
            priorFindings
          )}`,
        },
      ],
      output_config: { format: zodOutputFormat(DiagnosisSchema) },
    })
  );

  if (!response.parsed_output) {
    throw new Error("Claude response did not match the diagnosis schema.");
  }

  const latencyMs = Date.now() - startedAt;
  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const costUsd =
    (tokensIn / 1_000_000) * INPUT_COST_PER_MTOK + (tokensOut / 1_000_000) * OUTPUT_COST_PER_MTOK;

  return { data: response.parsed_output, tokensIn, tokensOut, costUsd, latencyMs };
}
