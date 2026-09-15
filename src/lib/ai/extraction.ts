import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "./client";
import { withRetries } from "./retry";

// Stage 1 — Extraction (ARCHITECTURE.md section 4). Cheapest/fastest tier —
// this is a structured-extraction task, not open-ended reasoning.
export const EXTRACTION_MODEL = "claude-haiku-4-5";
// $/1M tokens for EXTRACTION_MODEL (Haiku 4.5) — used to populate ai_calls.cost_usd.
const INPUT_COST_PER_MTOK = 1.0;
const OUTPUT_COST_PER_MTOK = 5.0;

const FindingSchema = z.object({
  description: z.string(),
  owner: z.string().nullable(),
});

const ResolvedMentionSchema = z.object({
  finding_type: z.enum(["blocker", "risk", "dependency"]),
  description: z.string(),
});

export const ExtractionSchema = z.object({
  blockers: z.array(FindingSchema),
  risks: z.array(FindingSchema),
  dependencies: z.array(FindingSchema),
  decisions: z.array(
    z.object({
      description: z.string(),
      decision_status: z.enum(["taken", "pending"]),
      owner: z.string().nullable(),
    })
  ),
  resolved_mentions: z.array(ResolvedMentionSchema),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type ExtractionResult = {
  data: Extraction;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

const SYSTEM_PROMPT = `You extract structured findings from a meeting transcript for an engineering team.

Identify every distinct:
- blocker: something actively stopping progress right now
- risk: something that could become a problem but hasn't blocked anything yet
- dependency: work that depends on another person/team/system
- decision: a choice that was made or needs to be made, with decision_status "taken" (already decided) or "pending" (still open)

Also identify every explicit statement that a blocker, risk, or dependency discussed in an EARLIER meeting has now been resolved, fixed, unblocked, or no longer applies — put these in resolved_mentions. Only include a mention when the transcript is explicit about it being resolved; never infer resolution from something simply not being mentioned again.

Rules:
- owner is the person named as responsible, or null if no one is named — never invent a name.
- description is a concise, self-contained sentence (a reader with no other context should understand it).
- Skip small talk and status updates that aren't a blocker/risk/dependency/decision.
- If a category has no findings, return an empty array for it — do not invent findings to fill it.
- For resolved_mentions, description should describe the ORIGINAL issue being resolved (so it can be matched against the earlier finding), not the resolution itself.`;

export async function extractFindings(
  transcript: string,
  meetingType: string
): Promise<ExtractionResult> {
  const startedAt = Date.now();

  const response = await withRetries(() =>
    anthropic.messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Meeting type: ${meetingType}\n\nTranscript:\n${transcript}`,
        },
      ],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    })
  );

  if (!response.parsed_output) {
    throw new Error("Claude response did not match the extraction schema.");
  }

  const latencyMs = Date.now() - startedAt;
  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const costUsd =
    (tokensIn / 1_000_000) * INPUT_COST_PER_MTOK +
    (tokensOut / 1_000_000) * OUTPUT_COST_PER_MTOK;

  return { data: response.parsed_output, tokensIn, tokensOut, costUsd, latencyMs };
}
