/**
 * WSDA judge prompt + transcript segmentation checks (steps 1–2).
 * Run: node --experimental-strip-types scripts/verify-wsda-judge-prompts.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WSDA_JUDGE_SEGMENTS,
  bucketWsdaHumanSegments,
  humanPhaseToJudgeSegment,
  inferPhaseAtEachEntry,
  isHumanTranscriptSpeaker,
  segmentWsdaTranscript,
} from "../src/lib/debate/wsda-transcript-segments.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const parseSrc = readFileSync(join(root, "src/lib/llm/wsda-judge-parse.ts"), "utf8");
const judgePromptsSrc = readFileSync(
  join(root, "src/lib/llm/wsda-judge-prompts.ts"),
  "utf8",
);
const tasksSrc = readFileSync(join(root, "src/lib/llm/tasks.ts"), "utf8");

const sampleTranscript = [
  { speaker: "System", text: "Debate opened: Test motion", at: "2026-01-01T00:00:00Z" },
  { speaker: "System", text: "Session 1/10: Pro Constructive. Present the Pro's case.", at: "2026-01-01T00:00:01Z" },
  { speaker: "You (Pro)", text: "I affirm because education improves outcomes.", at: "2026-01-01T00:01:00Z", phaseIndex: 0 },
  { speaker: "AI Opponent (Con)", text: "I negate; costs outweigh benefits.", at: "2026-01-01T00:03:00Z", phaseIndex: 0 },
  {
    speaker: "System",
    text: "Session 1/10 (Pro Constructive) has ended. Next — Session 2/10: Con Cross-Examination of the Pro.",
    at: "2026-01-01T00:04:00Z",
  },
  { speaker: "You (Pro)", text: "My warrant still holds under scrutiny.", at: "2026-01-01T00:05:00Z", phaseIndex: 1 },
];

const legacyTranscript = [
  { speaker: "System", text: "Debate opened: Legacy round", at: "2026-01-01T00:00:00Z" },
  { speaker: "System", text: "Session 1/10: Pro Constructive. purpose", at: "2026-01-01T00:00:01Z" },
  { speaker: "You (Pro)", text: "Constructive without phaseIndex field.", at: "2026-01-01T00:01:00Z" },
  {
    speaker: "System",
    text: "Session 1/10 (Pro Constructive) has ended. Next — Session 2/10: Con Cross-Examination of the Pro.",
    at: "2026-01-01T00:04:00Z",
  },
  { speaker: "You (Pro)", text: "Defense answer without phaseIndex.", at: "2026-01-01T00:05:00Z" },
];

let failed = 0;

function check(name, ok) {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failed += 1;
  console.log(`${mark}  ${name}`);
}

check("judge prompts module exports buildWsdaJudgeSystemPrompt", judgePromptsSrc.includes("export function buildWsdaJudgeSystemPrompt"));
check("judge prompts module exports buildWsdaJudgeUserPrompt", judgePromptsSrc.includes("export function buildWsdaJudgeUserPrompt"));
check("judge prompts include userAssessment schema", judgePromptsSrc.includes("userAssessment"));
check("judge prompts include persuasivenessTotal", judgePromptsSrc.includes("persuasivenessTotal"));
check("judge prompts re-export judge constants", judgePromptsSrc.includes("WSDA_JUDGE_ASPECTS"));
check("judge prompts accept humanSegmentedTranscript", judgePromptsSrc.includes("humanSegmentedTranscript"));

check("5 segment keys in shared module", WSDA_JUDGE_SEGMENTS.length === 5);
check(
  "segment keys match doc",
  WSDA_JUDGE_SEGMENTS.join(",") ===
    "constructive,crossExAttack,crossExDefense,rebuttal,finalFocus",
);

check("humanPhaseToJudgeSegment pro constructive", humanPhaseToJudgeSegment("pro", 0) === "constructive");
check("humanPhaseToJudgeSegment pro CX defense", humanPhaseToJudgeSegment("pro", 1) === "crossExDefense");
check("humanPhaseToJudgeSegment pro CX attack", humanPhaseToJudgeSegment("pro", 3) === "crossExAttack");
check("humanPhaseToJudgeSegment con constructive", humanPhaseToJudgeSegment("con", 2) === "constructive");
check("humanPhaseToJudgeSegment prep null", humanPhaseToJudgeSegment("pro", 4) === null);

check("isHumanTranscriptSpeaker detects You (Pro)", isHumanTranscriptSpeaker("You (Pro)", "pro"));
check("isHumanTranscriptSpeaker detects arena You", isHumanTranscriptSpeaker("Alex (You)", "con"));
check("isHumanTranscriptSpeaker rejects opponent", !isHumanTranscriptSpeaker("AI (Con)", "pro"));

const phases = inferPhaseAtEachEntry(legacyTranscript);
check("infer phase 0 on constructive", phases[2] === 0);
check("infer phase 1 after transition", phases[4] === 1);

const buckets = bucketWsdaHumanSegments(sampleTranscript, "pro");
check("bucket constructive", buckets.constructive.length === 1 && buckets.constructive[0].includes("education"));
check("bucket crossExDefense", buckets.crossExDefense.length === 1 && buckets.crossExDefense[0].includes("warrant"));
check("bucket crossExAttack empty for pro sample", buckets.crossExAttack.length === 0);

const legacyBuckets = bucketWsdaHumanSegments(legacyTranscript, "pro");
check("legacy fallback buckets constructive", legacyBuckets.constructive[0].includes("Constructive without"));
check("legacy fallback buckets defense", legacyBuckets.crossExDefense[0].includes("Defense answer"));

const segmentedText = segmentWsdaTranscript(sampleTranscript, "pro");
check("segmentWsdaTranscript lists all segment headers", WSDA_JUDGE_SEGMENTS.every((s) => segmentedText.includes(`(${s})`)));
check("segmentWsdaTranscript includes opponent line", segmentedText.includes("AI Opponent (Con)"));
check("segmentWsdaTranscript includes human constructive", segmentedText.includes("education improves outcomes"));

const debateChatSrc = readFileSync(join(root, "src/components/DebateChatPanel.tsx"), "utf8");
check("DebateChatPanel stamps phaseIndex on user posts", debateChatSrc.includes("...(isWsda ? { phaseIndex } : {})"));
check("DebateChatPanel stamps phaseIndex on opponent posts", debateChatSrc.includes("phaseIndex: phase,"));

const typesSrc = readFileSync(join(root, "src/lib/data/types.ts"), "utf8");
check("DebateTranscriptEntry has optional phaseIndex", typesSrc.includes("phaseIndex?: number"));
check("DebateResultScores supports wsda", typesSrc.includes("wsda?: WsdaUserJudgeAssessment"));

const aiResultsSrc = readFileSync(join(root, "src/lib/data/ai-results.ts"), "utf8");
check("ai-results passes wsda scores through", aiResultsSrc.includes("scores.wsda"));

check("tasks.ts branches WSDA judge", tasksSrc.includes("judgeWsdaDebateAndFeedback"));
check("tasks.ts uses buildWsdaJudgeSystemPrompt", tasksSrc.includes("buildWsdaJudgeSystemPrompt"));
check("judge prompts call segmentWsdaTranscript", judgePromptsSrc.includes("segmentWsdaTranscript(input.transcript"));
check("tasks.ts WSDA judge maxTokens 4096", tasksSrc.includes("generateJudgeWithRetries(provider, model, messages, 4096)"));

check("wsda-judge-parse exports parseWsdaJudgeModelOutput", parseSrc.includes("export function parseWsdaJudgeModelOutput"));
check("wsda-judge-parse exports deriveLegacyScoresFromWsda", parseSrc.includes("export function deriveLegacyScoresFromWsda"));
check("wsda-judge-parse exports buildLowContentWsdaJudgeScores", parseSrc.includes("export function buildLowContentWsdaJudgeScores"));
check("wsda-judge-parse uses snapAspectScore", parseSrc.includes("export function snapAspectScore"));

function snapAspectScoreLocal(value) {
  const allowed = [0, 0.5, 0.8, 1];
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const score of allowed) {
    const distance = Math.abs(value - score);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = score;
    }
  }
  return best;
}
check("snapAspectScore nearest 0.8", snapAspectScoreLocal(0.75) === 0.8);
check("snapAspectScore invalid -> 0", snapAspectScoreLocal("bad") === 0);

check("finalize-debate uses low content WSDA scores", readFileSync(join(root, "src/app/api/ai/finalize-debate/route.ts"), "utf8").includes("buildLowContentWsdaJudgeScores"));

const finalizeSrc = readFileSync(join(root, "src/app/api/ai/finalize-debate/route.ts"), "utf8");
check("arena persist merges wsda scores for user side", finalizeSrc.includes("scores: mergedScores"));
check("arena persist passes userRole", finalizeSrc.includes("userRole,"));

const historySrc = readFileSync(join(root, "src/lib/data/history-storage.ts"), "utf8");
check("history-storage preserves wsda scores", historySrc.includes("scores.wsda"));

const resultDetailSrc = readFileSync(join(root, "src/components/results/DebateResultDetail.tsx"), "utf8");
const wsdaBreakdownSrc = readFileSync(join(root, "src/components/results/WsdaJudgeScoreBreakdown.tsx"), "utf8");
check("DebateResultDetail renders WsdaJudgeScoreBreakdown", resultDetailSrc.includes("WsdaJudgeScoreBreakdown"));
check("DebateResultDetail shows wsda when present", resultDetailSrc.includes("r.scores.wsda"));
check("WsdaJudgeScoreBreakdown shows total /60", wsdaBreakdownSrc.includes("WSDA_JUDGE_TOTAL_MAX"));
check("WsdaJudgeScoreBreakdown segment table", wsdaBreakdownSrc.includes("WSDA_JUDGE_SEGMENTS.map"));
check("WsdaJudgeScoreBreakdown aspect columns", wsdaBreakdownSrc.includes("WSDA_JUDGE_ASPECTS.map"));

if (failed > 0) {
  process.exitCode = 1;
  console.log(`\n${failed} check(s) failed.`);
} else {
  console.log("\nAll WSDA judge prompt + segmentation checks passed.");
}
