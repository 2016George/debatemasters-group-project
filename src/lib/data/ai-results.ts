import type { DebateResult, DebateTranscriptEntry, DebateResultScores } from "@/lib/data/types";
import { progressionFieldsAfterMatch } from "@/lib/progression/experience";

export type AiJudgeSummary = {
  winner: "pro" | "con";
  confidence: number;
  rationale: string;
  feedback: string;
  quote: string;
  scores: DebateResultScores;
};

type BuildLocalJudgedResultInput = {
  sessionId: string;
  topicTitle: string;
  userRole?: "pro" | "con";
  transcript: DebateTranscriptEntry[];
  debateFormat?: "wsda" | "free_form";
  judgement: AiJudgeSummary;
  /** Lifetime XP before this match (from `profiles` or guest snapshot). */
  totalExperienceBefore?: number;
  /** When set (e.g. arena), XP base matches live WSDA rewards. */
  arenaRoomId?: string;
};

export function buildLocalAiJudgedResult(
  input: BuildLocalJudgedResultInput,
): DebateResult {
  const now = new Date().toISOString();
  const side = input.userRole === "con" ? "con" : "pro";
  const won = side === input.judgement.winner;
  const outcome: DebateResult["outcome"] = won ? "victory" : "effort";
  const prog = progressionFieldsAfterMatch({
    totalExperienceBefore: input.totalExperienceBefore ?? 0,
    outcome,
    arenaRoomId: input.arenaRoomId,
    scores: input.judgement.scores,
  });
  const confidencePct = Math.round(Math.max(0, Math.min(1, input.judgement.confidence)) * 100);

  return {
    id: `judged_${input.sessionId}_${Date.now()}`,
    topicTitle: input.topicTitle,
    debatedAt: now,
    outcome,
    headline: won ? "AI JUDGE: VICTORY" : "AI JUDGE: REBUILD",
    subline: `Winner: ${input.judgement.winner.toUpperCase()} (${confidencePct}% confidence)`,
    ...prog,
    feedback: `${input.judgement.feedback} Decision rationale: ${input.judgement.rationale}`,
    quote: input.judgement.quote,
    scores: {
      clarity: input.judgement.scores.clarity,
      evidence: input.judgement.scores.evidence,
      ...(input.judgement.scores.wsda
        ? { wsda: input.judgement.scores.wsda }
        : {}),
    },
    suggestedTomes: won
      ? [
          {
            title: "Closing Calculus",
            subtitle: "Protect your strongest warrant",
            kind: "rare",
            label: "+3 Focus",
            accent: "primary",
            icon: "menu_book",
          },
          {
            title: "Judge Adaptation II",
            subtitle: "Convert flow into ballots",
            kind: "enchanted",
            label: "+2 Lvl",
            accent: "tertiary",
            icon: "psychology",
          },
        ]
      : [
          {
            title: "Warrant Forge I",
            subtitle: "Link claim to mechanism",
            kind: "rare",
            label: "+2 Focus",
            accent: "primary",
            icon: "menu_book",
          },
          {
            title: "Evidence Refit",
            subtitle: "Prioritize comparative proof",
            kind: "enchanted",
            label: "+1 Lvl",
            accent: "tertiary",
            icon: "psychology",
          },
        ],
    loot: won
      ? [{ label: "Judge Seal x1", tone: "emerald" }]
      : [{ label: "Practice Token x40", tone: "gold" }],
    transcript: [...input.transcript],
  };
}
