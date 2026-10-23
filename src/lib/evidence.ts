// Phase 9 — "show me where the AI got this": locates the transcript passage a
// finding was most likely extracted from. Pure lexical matching, computed at
// render time, so it costs zero AI tokens and needs no schema change. It's a
// best-effort pointer, not a guarantee — the extraction model paraphrases, so
// a finding with no confident match simply shows no evidence rather than a
// wrong quote.

export type Evidence = { text: string; lineIndexes: number[]; score: number };

// Below this share of the finding's keywords appearing in a passage, the
// match is more likely coincidence than source.
const MIN_COVERAGE = 0.35;
const MIN_SHARED_KEYWORDS = 2;
// Long single-line transcripts (common with pasted text) get split into
// sentences so a match points at a passage, not the entire meeting.
const MAX_SEGMENT_CHARS = 400;

const STOPWORDS = new Set([
  // English
  "the", "and", "for", "that", "this", "with", "from", "have", "has", "had", "are", "was",
  "were", "will", "would", "should", "could", "can", "not", "but", "about", "into", "they",
  "them", "their", "there", "then", "than", "what", "when", "which", "who", "you", "our",
  "your", "its", "also", "been", "being", "still", "just", "some", "any", "all", "out",
  "yet", "now", "new", "next", "need", "needs",
  // Portuguese
  "que", "com", "para", "por", "uma", "dos", "das", "nos", "nas", "mais", "como", "mas",
  "foi", "ser", "tem", "isso", "esse", "essa", "este", "esta", "ainda", "sobre", "pelo",
  "pela", "ele", "ela", "eles", "elas", "vai", "vamos", "aqui", "agora", "precisa",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Crude stemming by prefix: "deployment"/"deploys"/"deployed" all collapse to
// "deplo", which is enough to survive the model's rewording of a sentence.
export function keywords(text: string): Set<string> {
  const words = normalize(text).match(/[a-z0-9]+/g) ?? [];
  const result = new Set<string>();
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    result.add(word.length > 5 ? word.slice(0, 5) : word);
  }
  return result;
}

// "Ana (PM): text" → speaker + text, so the transcript view can set the
// speaker apart from what they said. Lines without a speaker prefix pass
// through untouched.
const SPEAKER_PATTERN = /^([A-ZÀ-Ý][\p{L} .'-]{0,40}?(?:\s*\([^)]{1,30}\))?):\s+(.+)$/u;

export function splitSpeaker(line: string): { speaker: string | null; text: string } {
  const match = SPEAKER_PATTERN.exec(line);
  return match ? { speaker: match[1], text: match[2] } : { speaker: null, text: line };
}

export function splitTranscript(transcript: string): string[] {
  const segments: string[] = [];
  for (const rawLine of transcript.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length <= MAX_SEGMENT_CHARS) {
      segments.push(line);
      continue;
    }
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      if (sentence.trim()) segments.push(sentence.trim());
    }
  }
  return segments;
}

function coverage(target: Set<string>, passage: Set<string>): { shared: number; score: number } {
  let shared = 0;
  for (const word of target) if (passage.has(word)) shared += 1;
  return { shared, score: target.size === 0 ? 0 : shared / target.size };
}

// Scores every single segment and every adjacent pair (a finding often
// spans one speaker's question and the next one's answer). A pair must beat
// the best single segment outright to win, so the quote stays as tight as
// the evidence allows.
export function findEvidence(segments: string[], description: string): Evidence | null {
  const target = keywords(description);
  if (target.size === 0) return null;

  const segmentKeywords = segments.map(keywords);
  let best: Evidence | null = null;

  const consider = (lineIndexes: number[], passage: Set<string>) => {
    const { shared, score } = coverage(target, passage);
    if (shared < MIN_SHARED_KEYWORDS || score < MIN_COVERAGE) return;
    if (!best || score > best.score) {
      best = { text: lineIndexes.map((i) => segments[i]).join(" "), lineIndexes, score };
    }
  };

  for (let i = 0; i < segments.length; i++) consider([i], segmentKeywords[i]);
  for (let i = 0; i + 1 < segments.length; i++) {
    consider([i, i + 1], new Set([...segmentKeywords[i], ...segmentKeywords[i + 1]]));
  }

  return best;
}
