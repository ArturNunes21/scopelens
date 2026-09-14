import Anthropic from "@anthropic-ai/sdk";

// Up to 2 retries with backoff per individual call (ARCHITECTURE.md section 3,
// resolves GAPS.md G13) — only for retryable failures, not bad input. Shared
// across every pipeline stage (extraction/diagnosis/synthesis).
export async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
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
