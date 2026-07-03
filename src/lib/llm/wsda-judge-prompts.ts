/**
 * WSDA AI judge prompts — sourced from judge prompt (fixed).docx.
 * Skill (30) + persuasiveness (30) = 60 max; user-only detailed breakdown in JSON output.
 */

import type { AgeBand, DebateTranscriptEntry } from "@/lib/data/types";
import { segmentWsdaTranscript } from "@/lib/debate/wsda-transcript-segments";

export {
  WSDA_JUDGE_ASPECT_SCORES,
  WSDA_JUDGE_ASPECTS,
  WSDA_JUDGE_PERSUASIVENESS_MAX,
  WSDA_JUDGE_SEGMENTS,
  WSDA_JUDGE_SKILL_MAX,
  WSDA_JUDGE_TOTAL_MAX,
  type WsdaJudgeAspect,
  type WsdaJudgeAspectScore,
  type WsdaJudgeSegment,
} from "@/lib/debate/wsda-transcript-segments";

export type WsdaJudgePromptInput = {
  topicTitle: string;
  userRole: "pro" | "con";
  ageBand?: AgeBand;
  transcript: DebateTranscriptEntry[];
  /**
   * Optional pre-segmented transcript override.
   * When omitted, segmentWsdaTranscript() buckets human speech automatically.
   */
  humanSegmentedTranscript?: string;
};

/** Opening persona from the docx. */
export const WSDA_JUDGE_BASE_PERSONA =
  "You are an intelligent AI debate judge. You will rank the two speakers, one human and one AI, " +
  "by their skill and influence in the debate. " +
  "You should give your assessment in 2 parts: persuasiveness and skill. Both are worth 30 pts.";

/** Skill scoring framework from the docx. */
export const WSDA_JUDGE_SKILL_FRAMEWORK =
  "Skill: there are 6 aspects: 1. Logic 2. Coherence 3. Grammar 4. Evidence 5. Reactions 6. Articulation. " +
  "Give points 1 if it was done well, 0.8 if above average, 0.5 if average, and 0 if below average. " +
  "Do it for every part of the debate (constructive, attack cross examination, defense cross ex, rebuttal, final focus) " +
  "for every 6 aspects, totaling a maximum of 30. " +
  "For persuasiveness points, give them based on how much they persuaded you (0–30, holistic).";

/** Constructive speech rubric — section 1 of the docx. */
export const WSDA_JUDGE_RUBRIC_CONSTRUCTIVE =
  "1. Constructive Speech. " +
  "Logic — Is their model well presented? Is their idea of the debate adequate? Are their points without apparent flaws? " +
  "Give points based on whether they gave points that were logically correct, appliable, and actually do happen. " +
  "Do they have any self contradictions or logical fallacies? If so, minus points. " +
  "For coherence, the key is whether they gave a model that was adequate for the topic and whether their points were adequately matching. " +
  "On grammar, in every single part of the debate, grade them on their linguistic skill only for grammar. " +
  "For evidence, check whether the points they described have any stated influence on the real world or any stated reports. " +
  "They do not necessarily have to give statistics. " +
  "Reaction is based on your reaction to their points. " +
  "Articulation is how well they organized their speech. Standard articulation should include signposts, key reasons, and facts.";

/** Attack cross-examination rubric — section 2 of the docx. */
export const WSDA_JUDGE_RUBRIC_CROSS_EX_ATTACK =
  "2. Attack cross examination: " +
  "Logic: are the questions reasonable and well stated with few flaws? " +
  "Coherence: Does the main point of their questions differ from their opponent's key point? If so, minus points. " +
  "Are the questions themselves coherent with the real world? Are they actually real concerns and not wild speculations? " +
  "Do they react well to their opponent's replies? " +
  "Grammar: same as in the first part. " +
  "Evidence: Are the questions themselves rooted in the real world and is the main point of them real, not hypothetical? If so, good. " +
  "If the questions are like rebuttals, do not give them any points. " +
  "Articulation: Do the questions flow well? Are they short and succinct like they are supposed to? " +
  "If they are too long and too aggressive, minus points. " +
  "Reaction: did they make you actually believe that their problem was effective?";

/** Defense cross-examination rubric — section 3 of the docx. */
export const WSDA_JUDGE_RUBRIC_CROSS_EX_DEFENSE =
  "3. Cross examination defense: " +
  "Logic: Are their responses correct and without logical jumps? Are their replies tactical and sensible? " +
  "Coherence: Are their replies coherent with not only their opponent's points but also their own point? Do their replies concede with the model? " +
  "Grammar: same as always. " +
  "Evidence: Their responses should be well backed up and well defended by the real world's concepts or their own points. " +
  "If they say there is not enough time, wait until they address it to give points in the category. " +
  "If they actually do not address it in their own speech, give them a zero. " +
  "Reaction: Did they make you think their answer was an effective one? " +
  "Articulation: Is their reply well said and well articulated?";

/** Rebuttal rubric — section 4 of the docx. */
export const WSDA_JUDGE_RUBRIC_REBUTTAL =
  "4. Rebuttal: " +
  "Logic: Is their rebuttal without any logical flaw? Are there any logical jumps that could constitute an error? " +
  "Coherence: in the frame of the debate, is the rebuttal sensible? " +
  "Grammar: same. " +
  "Articulation: Was their rebuttal well stated? " +
  "Reaction: was it persuasive?";

/** Final focus rubric — section 5 of the docx. */
export const WSDA_JUDGE_RUBRIC_FINAL_FOCUS =
  "5. Final focus: " +
  "Logic: is the final focus correct in the sense of making logical sense in this debate? " +
  "Coherence: is it readily coherent and of accords to the rest of this debate? Did they identify key clashes in this debate? " +
  "Reaction: Did it make it seem like that side had won the debate? " +
  "Grammar: same as always. " +
  "Articulation: was it well done in the sense that it was at an acceptable pace of a recap of this debate.";

/** JSON output contract appended to the user prompt. */
export const WSDA_JUDGE_JSON_SCHEMA_INSTRUCTIONS = [
  "Return strict JSON only with these keys: winner, confidence, rationale, feedback, quote, userAssessment.",
  'winner must be "pro" or "con" (compare both speakers; the human is on the USER SIDE below).',
  "confidence is a number 0-1.",
  "rationale explains why the winning side won.",
  "feedback is 2-4 sentences, actionable, age-appropriate for the audience guidance.",
  "quote is one memorable sentence from or about the human debater.",
  "userAssessment scores ONLY the human debater on the USER SIDE:",
  "  skillTotal: sum of all 30 aspect cells (0-30).",
  "  persuasivenessTotal: holistic 0-30.",
  "  total: skillTotal + persuasivenessTotal (0-60).",
  "  segments: object with keys constructive, crossExAttack, crossExDefense, rebuttal, finalFocus.",
  "  Each segment has exactly: logic, coherence, grammar, evidence, reactions, articulation.",
  "  Each aspect value must be exactly one of: 0, 0.5, 0.8, 1.",
  "If the human had no speech in a segment, score that segment 0 on every aspect.",
  "Do not include opponent per-aspect breakdown — only userAssessment for the human.",
].join("\n");

function joinPromptParts(...parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function ageBandToneGuide(ageBand: AgeBand | undefined): string {
  const band = ageBand ?? "10-14";
  if (band === "under10") {
    return "Audience age: under 10. Use very simple words, short sentences, friendly examples, and a supportive tone. Avoid jargon and abstract terms.";
  }
  if (band === "10-14") {
    return "Audience age: 10-14. Use clear, plain language with moderate vocabulary, concrete examples, and encouraging tone.";
  }
  if (band === "15-18") {
    return "Audience age: 15-18. Use standard academic vocabulary, structured reasoning, and balanced constructive critique.";
  }
  return "Audience age: 18+. Use mature, concise language and nuanced analysis while staying clear and practical.";
}

/** Maps USER SIDE to WSDA round sessions for each doc segment (for judge orientation). */
export function wsdaUserSegmentPhaseGuide(userRole: "pro" | "con"): string {
  if (userRole === "pro") {
    return [
      "Human segment mapping (Pro side):",
      "- constructive: Pro Constructive (Session 1 / phase 0)",
      "- crossExAttack: Pro Cross-Examination of Con — human asks (Session 4 / phase 3)",
      "- crossExDefense: Con Cross-Examination of Pro — human answers (Session 2 / phase 1)",
      "- rebuttal: Pro Rebuttal (Session 6 / phase 5)",
      "- finalFocus: Pro Conclusion Speech (Session 9 / phase 8)",
    ].join("\n");
  }
  return [
    "Human segment mapping (Con side):",
    "- constructive: Con Constructive (Session 3 / phase 2)",
    "- crossExAttack: Con Cross-Examination of Pro — human asks (Session 2 / phase 1)",
    "- crossExDefense: Pro Cross-Examination of Con — human answers (Session 4 / phase 3)",
    "- rebuttal: Con Rebuttal (Session 7 / phase 6)",
    "- finalFocus: Con Conclusion Speech (Session 10 / phase 9)",
  ].join("\n");
}

/**
 * Full WSDA judge system prompt from the docx (persona + rubric + JSON rules).
 */
export function buildWsdaJudgeSystemPrompt(): string {
  return joinPromptParts(
    WSDA_JUDGE_BASE_PERSONA,
    WSDA_JUDGE_SKILL_FRAMEWORK,
    WSDA_JUDGE_RUBRIC_CONSTRUCTIVE,
    WSDA_JUDGE_RUBRIC_CROSS_EX_ATTACK,
    WSDA_JUDGE_RUBRIC_CROSS_EX_DEFENSE,
    WSDA_JUDGE_RUBRIC_REBUTTAL,
    WSDA_JUDGE_RUBRIC_FINAL_FOCUS,
    WSDA_JUDGE_JSON_SCHEMA_INSTRUCTIONS,
  );
}

/**
 * User prompt for WSDA judging: topic, human side, age tone, transcript, segment guide.
 */
export function buildWsdaJudgeUserPrompt(input: WsdaJudgePromptInput): string {
  const userSide = input.userRole === "con" ? "con" : "pro";
  const transcriptBlock =
    input.humanSegmentedTranscript?.trim() ||
    segmentWsdaTranscript(input.transcript, userSide);

  return joinPromptParts(
    `Topic: ${input.topicTitle}`,
    "Format: WSDA",
    `User side (human debater): ${userSide.toUpperCase()}`,
    ageBandToneGuide(input.ageBand),
    wsdaUserSegmentPhaseGuide(userSide),
    "Evaluate based on the entire transcript. Score only the human on the USER SIDE with userAssessment.",
    "Compare both speakers to choose winner and confidence.",
    "Transcript (human speech segmented; opponent summary for comparison):",
    transcriptBlock,
    "Return JSON per the schema in the system prompt.",
  );
}
