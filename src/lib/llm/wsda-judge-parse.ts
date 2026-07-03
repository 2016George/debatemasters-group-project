import type {
  WsdaAspectScore,
  WsdaSegmentScores,
  WsdaUserJudgeAssessment,
} from "../data/types";
import {
  WSDA_JUDGE_ASPECTS,
  WSDA_JUDGE_ASPECT_SCORES,
  WSDA_JUDGE_PERSUASIVENESS_MAX,
  WSDA_JUDGE_SEGMENTS,
  WSDA_JUDGE_SKILL_MAX,
  WSDA_JUDGE_TOTAL_MAX,
  type WsdaJudgeAspect,
} from "../debate/wsda-transcript-segments";

const ZERO_SEGMENT: WsdaSegmentScores = {
  logic: 0,
  coherence: 0,
  grammar: 0,
  evidence: 0,
  reactions: 0,
  articulation: 0,
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Snap model output to the nearest allowed doc rubric cell score. */
export function snapAspectScore(value: unknown): WsdaAspectScore {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  let best: WsdaAspectScore = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const allowed of WSDA_JUDGE_ASPECT_SCORES) {
    const distance = Math.abs(value - allowed);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = allowed;
    }
  }
  return best;
}

function parseSegmentScores(raw: unknown): WsdaSegmentScores {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const segment = {} as WsdaSegmentScores;
  for (const aspect of WSDA_JUDGE_ASPECTS) {
    segment[aspect] = snapAspectScore(source[aspect]);
  }
  return segment;
}

function sumSegmentScores(segments: WsdaUserJudgeAssessment["segments"]): number {
  let total = 0;
  for (const segmentKey of WSDA_JUDGE_SEGMENTS) {
    const segment = segments[segmentKey];
    for (const aspect of WSDA_JUDGE_ASPECTS) {
      total += segment[aspect];
    }
  }
  return roundOneDecimal(total);
}

export function emptyWsdaUserAssessment(): WsdaUserJudgeAssessment {
  const segments = {
    constructive: { ...ZERO_SEGMENT },
    crossExAttack: { ...ZERO_SEGMENT },
    crossExDefense: { ...ZERO_SEGMENT },
    rebuttal: { ...ZERO_SEGMENT },
    finalFocus: { ...ZERO_SEGMENT },
  };
  return {
    skillTotal: 0,
    persuasivenessTotal: 0,
    total: 0,
    segments,
  };
}

export function parseWsdaUserAssessment(raw: unknown): WsdaUserJudgeAssessment {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const segmentsRaw =
    source.segments && typeof source.segments === "object"
      ? (source.segments as Record<string, unknown>)
      : {};

  const segments = {} as WsdaUserJudgeAssessment["segments"];
  for (const segmentKey of WSDA_JUDGE_SEGMENTS) {
    segments[segmentKey] = parseSegmentScores(segmentsRaw[segmentKey]);
  }

  const skillTotal = Math.min(
    WSDA_JUDGE_SKILL_MAX,
    sumSegmentScores(segments),
  );
  const persuasivenessRaw =
    typeof source.persuasivenessTotal === "number" &&
    Number.isFinite(source.persuasivenessTotal)
      ? source.persuasivenessTotal
      : 0;
  const persuasivenessTotal = roundOneDecimal(
    Math.min(WSDA_JUDGE_PERSUASIVENESS_MAX, Math.max(0, persuasivenessRaw)),
  );
  const total = roundOneDecimal(
    Math.min(WSDA_JUDGE_TOTAL_MAX, skillTotal + persuasivenessTotal),
  );

  return {
    skillTotal,
    persuasivenessTotal,
    total,
    segments,
  };
}

function averageAspectValues(
  segments: WsdaUserJudgeAssessment["segments"],
  aspects: readonly WsdaJudgeAspect[],
): number {
  const values: number[] = [];
  for (const segmentKey of WSDA_JUDGE_SEGMENTS) {
    const segment = segments[segmentKey];
    for (const aspect of aspects) {
      values.push(segment[aspect]);
    }
  }
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

/** Map WSDA rubric cells to legacy 0–5 clarity/evidence for XP and SQL compat. */
export function deriveLegacyScoresFromWsda(
  assessment: WsdaUserJudgeAssessment,
): { clarity: number; evidence: number } {
  const clarityAvg = averageAspectValues(assessment.segments, [
    "logic",
    "coherence",
    "grammar",
    "articulation",
  ]);
  const evidenceAvg = averageAspectValues(assessment.segments, [
    "evidence",
    "reactions",
  ]);
  return {
    clarity: roundOneDecimal(clamp01(clarityAvg) * 5),
    evidence: roundOneDecimal(clamp01(evidenceAvg) * 5),
  };
}

export function calibrateLegacyScores(input: {
  userRole: "pro" | "con";
  winner: "pro" | "con";
  confidence: number;
  clarity: number;
  evidence: number;
}): { clarity: number; evidence: number } {
  const { userRole, winner, confidence } = input;
  let clarity = input.clarity;
  let evidence = input.evidence;
  const userLost = userRole !== winner;
  if (userLost && confidence >= 0.9) {
    clarity = Math.min(clarity, 3.2);
    evidence = Math.min(evidence, 3.2);
  } else if (userLost && confidence >= 0.8) {
    clarity = Math.min(clarity, 3.8);
    evidence = Math.min(evidence, 3.8);
  }
  return {
    clarity: roundOneDecimal(clarity),
    evidence: roundOneDecimal(evidence),
  };
}

export function buildWsdaJudgeScores(input: {
  userAssessment: WsdaUserJudgeAssessment;
  userRole: "pro" | "con";
  winner: "pro" | "con";
  confidence: number;
}): {
  clarity: number;
  evidence: number;
  wsda: WsdaUserJudgeAssessment;
} {
  const derived = deriveLegacyScoresFromWsda(input.userAssessment);
  const calibrated = calibrateLegacyScores({
    userRole: input.userRole,
    winner: input.winner,
    confidence: input.confidence,
    clarity: derived.clarity,
    evidence: derived.evidence,
  });
  return {
    ...calibrated,
    wsda: input.userAssessment,
  };
}

export function buildLowContentWsdaJudgeScores(): {
  clarity: number;
  evidence: number;
  wsda: WsdaUserJudgeAssessment;
} {
  const wsda = emptyWsdaUserAssessment();
  return {
    clarity: 0,
    evidence: 0,
    wsda,
  };
}

export type ParsedWsdaJudgeFields = {
  winner: "pro" | "con";
  confidence: number;
  rationale: string;
  feedback: string;
  quote: string;
  scores: {
    clarity: number;
    evidence: number;
    wsda: WsdaUserJudgeAssessment;
  };
};

function clampText(value: string, maxLen: number): string {
  const v = value.trim();
  if (v.length <= maxLen) return v;
  return `${v.slice(0, maxLen - 3)}...`;
}

export function parseWsdaJudgeModelOutput(
  parsed: Record<string, unknown>,
  input: {
    userRole: "pro" | "con";
  },
): ParsedWsdaJudgeFields {
  const winner = parsed.winner === "con" ? "con" : "pro";
  const confidenceRaw =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? parsed.confidence
      : 0.65;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));
  const userAssessment = parseWsdaUserAssessment(parsed.userAssessment);
  const scores = buildWsdaJudgeScores({
    userAssessment,
    userRole: input.userRole,
    winner,
    confidence,
  });

  return {
    winner,
    confidence,
    rationale: clampText(
      String(parsed.rationale ?? "Decision generated by AI judge."),
      480,
    ),
    feedback: clampText(
      String(
        parsed.feedback ??
          "Maintain clear claim-warrant-impact structure and reinforce each point with direct evidence.",
      ),
      900,
    ),
    quote: clampText(
      String(parsed.quote ?? "A strong case wins when claims meet proof."),
      220,
    ),
    scores,
  };
}
