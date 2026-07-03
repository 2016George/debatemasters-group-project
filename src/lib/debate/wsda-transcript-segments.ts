/**
 * Bucket WSDA transcript lines into doc judge segments for the human debater.
 */

import type { DebateTranscriptEntry } from "../data/types";

/** Doc judge speech segments (shared with wsda-judge-prompts). */
export const WSDA_JUDGE_SEGMENTS = [
  "constructive",
  "crossExAttack",
  "crossExDefense",
  "rebuttal",
  "finalFocus",
] as const;

export type WsdaJudgeSegment = (typeof WSDA_JUDGE_SEGMENTS)[number];

/** Allowed per-aspect cell scores from the docx rubric. */
export const WSDA_JUDGE_ASPECT_SCORES = [0, 0.5, 0.8, 1] as const;

export type WsdaJudgeAspectScore = (typeof WSDA_JUDGE_ASPECT_SCORES)[number];

/** Six skill aspects scored in every speech segment. */
export const WSDA_JUDGE_ASPECTS = [
  "logic",
  "coherence",
  "grammar",
  "evidence",
  "reactions",
  "articulation",
] as const;

export type WsdaJudgeAspect = (typeof WSDA_JUDGE_ASPECTS)[number];

export const WSDA_JUDGE_SKILL_MAX = 30;
export const WSDA_JUDGE_PERSUASIVENESS_MAX = 30;
export const WSDA_JUDGE_TOTAL_MAX =
  WSDA_JUDGE_SKILL_MAX + WSDA_JUDGE_PERSUASIVENESS_MAX;

const SEGMENT_LABELS: Record<WsdaJudgeSegment, string> = {
  constructive: "Constructive Speech",
  crossExAttack: "Attack Cross-Examination",
  crossExDefense: "Defense Cross-Examination",
  rebuttal: "Rebuttal",
  finalFocus: "Final Focus",
};

/** Map WSDA phaseIndex + user side to doc rubric segment for the human. */
export function humanPhaseToJudgeSegment(
  userRole: "pro" | "con",
  phaseIndex: number,
): WsdaJudgeSegment | null {
  if (userRole === "pro") {
    if (phaseIndex === 0) return "constructive";
    if (phaseIndex === 1) return "crossExDefense";
    if (phaseIndex === 3) return "crossExAttack";
    if (phaseIndex === 5) return "rebuttal";
    if (phaseIndex === 8) return "finalFocus";
    return null;
  }
  if (phaseIndex === 2) return "constructive";
  if (phaseIndex === 1) return "crossExAttack";
  if (phaseIndex === 3) return "crossExDefense";
  if (phaseIndex === 6) return "rebuttal";
  if (phaseIndex === 9) return "finalFocus";
  return null;
}

export function isHumanTranscriptSpeaker(
  speaker: string,
  userRole: "pro" | "con",
): boolean {
  const normalized = speaker.trim().toLowerCase();
  if (normalized === "system") return false;
  if (normalized.includes("(you)")) return true;
  const tag = userRole === "pro" ? "you (pro)" : "you (con)";
  return normalized.includes(tag);
}

function parseSessionNumber(text: string): number | null {
  const match = text.match(/Session\s+(\d+)\s*\/\s*10/i);
  if (!match) return null;
  const session = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(session) || session < 1 || session > 10) return null;
  return session;
}

/** Infer active WSDA phase (0–9) at each transcript index from System lines. */
export function inferPhaseAtEachEntry(
  transcript: DebateTranscriptEntry[],
): number[] {
  let currentPhase = 0;
  const phases: number[] = [];

  for (const entry of transcript) {
    if (entry.speaker.trim().toLowerCase() === "system") {
      if (/Debate opened/i.test(entry.text)) {
        currentPhase = 0;
      }

      const nextSession = entry.text.match(
        /Next\s+[—\-]\s+Session\s+(\d+)\s*\/\s*10/i,
      );
      if (nextSession) {
        const session = Number.parseInt(nextSession[1] ?? "", 10);
        if (session >= 1 && session <= 10) {
          currentPhase = session - 1;
        }
      } else if (/Session\s+\d+\s*\/\s*10\s*:/i.test(entry.text)) {
        const session = parseSessionNumber(entry.text);
        if (session !== null) {
          currentPhase = session - 1;
        }
      }
    }

    phases.push(currentPhase);
  }

  return phases;
}

function emptySegmentBuckets(): Record<WsdaJudgeSegment, string[]> {
  return {
    constructive: [],
    crossExAttack: [],
    crossExDefense: [],
    rebuttal: [],
    finalFocus: [],
  };
}

/** Group human messages into doc judge segments. */
export function bucketWsdaHumanSegments(
  transcript: DebateTranscriptEntry[],
  userRole: "pro" | "con",
): Record<WsdaJudgeSegment, string[]> {
  const buckets = emptySegmentBuckets();
  const inferredPhases = inferPhaseAtEachEntry(transcript);

  transcript.forEach((entry, index) => {
    if (!isHumanTranscriptSpeaker(entry.speaker, userRole)) return;

    const text = entry.text.trim();
    if (!text) return;

    const phase =
      typeof entry.phaseIndex === "number" && Number.isFinite(entry.phaseIndex)
        ? entry.phaseIndex
        : inferredPhases[index];

    const segment = humanPhaseToJudgeSegment(userRole, phase);
    if (!segment) return;
    buckets[segment].push(text);
  });

  return buckets;
}

function formatHumanSegmentBlock(buckets: Record<WsdaJudgeSegment, string[]>): string {
  return WSDA_JUDGE_SEGMENTS.map((key) => {
    const lines = buckets[key];
    const body =
      lines.length > 0 ? lines.join("\n\n") : "(no human speech recorded)";
    return `### ${SEGMENT_LABELS[key]} (${key})\n${body}`;
  }).join("\n\n");
}

function formatOpponentSummary(
  transcript: DebateTranscriptEntry[],
  userRole: "pro" | "con",
): string {
  const lines = transcript
    .filter(
      (entry) =>
        entry.speaker.trim().toLowerCase() !== "system" &&
        !isHumanTranscriptSpeaker(entry.speaker, userRole),
    )
    .map((entry) => `${entry.speaker}: ${entry.text.trim()}`)
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : "(no opponent speech recorded)";
}

/**
 * Render human speech by doc segment + opponent summary for the WSDA judge prompt.
 */
export function segmentWsdaTranscript(
  transcript: DebateTranscriptEntry[],
  userRole: "pro" | "con",
): string {
  const buckets = bucketWsdaHumanSegments(transcript, userRole);
  return [
    "## Human debater (score with userAssessment)",
    formatHumanSegmentBlock(buckets),
    "## Opponent (for winner comparison only — do not score per-aspect)",
    formatOpponentSummary(transcript, userRole),
  ].join("\n\n");
}
