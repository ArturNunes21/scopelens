import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./client";

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

Rules:
- owner is the person named as responsible, or null if no one is named — never invent a name.
- description is a concise, self-contained sentence (a reader with no other context should understand it).
- Skip small talk and status updates that aren't a blocker/risk/dependency/decision.
- If a category has no findings, return an empty array for it — do not invent findings to fill it.`;

// Up to 2 retries with backoff per individual call (ARCHITECTURE.md section 3,
// resolves GAPS.md G13) — only for retryable failures, not bad input.
async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.APIConnectionError ||
        error instanceof Anthropic.InternalServerError;

      if (!retryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }

  throw lastError;
}

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
