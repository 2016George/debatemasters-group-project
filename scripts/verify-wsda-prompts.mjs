/**
 * WSDA docx prompt integration checks.
 * Run: node --experimental-strip-types scripts/verify-wsda-prompts.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildWsdaOpponentSystemPrompt,
  resolveWsdaOpponentSegmentPrompt,
  WSDA_CONCLUSION_PROMPT,
  WSDA_CONSTRUCTIVE_PROMPT,
  WSDA_CROSS_EX_ANSWER_PROMPT,
  WSDA_CROSS_EX_ASK_PROMPT,
  WSDA_DEBATE_TIPS,
  WSDA_OPPONENT_BASE_PERSONA,
  WSDA_REBUTTAL_PROMPT,
  wsdaOpponentDocSessionNumber,
  wsdaRoundSessionNumber,
} from "../src/lib/llm/wsda-opponent-prompts.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function includesAll(text, needles) {
  return needles.every((n) => text.includes(n));
}

const tasksSrc = read("src/lib/llm/tasks.ts");

const staticChecks = [
  {
    name: "tasks.ts imports buildWsdaOpponentSystemPrompt",
    ok: tasksSrc.includes('from "@/lib/llm/wsda-opponent-prompts"') ||
      tasksSrc.includes("buildWsdaOpponentSystemPrompt"),
  },
  {
    name: "opponentSystemPrompt delegates to docx module",
    ok:
      tasksSrc.includes("buildWsdaOpponentSystemPrompt({") &&
      !tasksSrc.includes("You are delivering a NEW WSDA constructive speech"),
  },
  {
    name: "Speech phases do not clamp character length",
    ok:
      tasksSrc.includes("maxTokens: 1400") &&
      tasksSrc.includes("maxChars: 0") &&
      !tasksSrc.includes("trimIncomplete: true"),
  },
  {
    name: "User prompt includes Session N/10 label",
    ok: tasksSrc.includes("wsdaRoundSessionNumber") &&
      tasksSrc.includes("Current WSDA Session"),
  },
];

const segmentCases = [
  {
    name: "phase 0 Pro constructive",
    input: { phaseIndex: 0, opponentSide: "Pro" },
    expectSnippet: "Constructive Speech",
    docSession: 1,
  },
  {
    name: "phase 2 Con constructive",
    input: { phaseIndex: 2, opponentSide: "Con" },
    expectSnippet: "Constructive Speech",
    docSession: 3,
  },
  {
    name: "phase 1 Con cross-ex ask",
    input: { phaseIndex: 1, crossExTurn: "ask", opponentSide: "Con" },
    expectSnippet: "Taking Cross Examinations",
    docSession: 2,
  },
  {
    name: "phase 1 Pro cross-ex answer",
    input: { phaseIndex: 1, crossExTurn: "answer", opponentSide: "Pro" },
    expectSnippet: "Cross Examination",
    docSession: 2,
  },
  {
    name: "phase 3 Con cross-ex answer",
    input: { phaseIndex: 3, crossExTurn: "answer", opponentSide: "Con" },
    expectSnippet: "Cross Examination",
    docSession: 4,
  },
  {
    name: "phase 3 Pro cross-ex ask",
    input: { phaseIndex: 3, crossExTurn: "ask", opponentSide: "Pro" },
    expectSnippet: "Taking Cross Examinations",
    docSession: 4,
  },
  {
    name: "phase 6 Con rebuttal",
    input: { phaseIndex: 6, opponentSide: "Con" },
    expectSnippet: "In your rebuttal",
    docSession: 7,
  },
  {
    name: "phase 9 Con conclusion",
    input: { phaseIndex: 9, opponentSide: "Con" },
    expectSnippet: "final focus",
    docSession: 10,
  },
  {
    name: "phase 4 prep returns null",
    input: { phaseIndex: 4, opponentSide: "Con" },
    expectNull: true,
  },
];

let failed = 0;

for (const c of staticChecks) {
  const mark = c.ok ? "PASS" : "FAIL";
  if (!c.ok) failed += 1;
  console.log(`${mark}  ${c.name}`);
}

for (const c of segmentCases) {
  const prompt = resolveWsdaOpponentSegmentPrompt(c.input);
  let ok;
  if (c.expectNull) {
    ok = prompt === null;
  } else {
    ok =
      prompt !== null &&
      prompt.includes(c.expectSnippet) &&
      includesAll(prompt, [
        WSDA_OPPONENT_BASE_PERSONA.slice(0, 24),
        WSDA_DEBATE_TIPS.slice(0, 10),
        "OUTPUT FORMAT",
      ]);
    const docSession = wsdaOpponentDocSessionNumber(
      c.input.opponentSide,
      c.input.phaseIndex,
      c.input.crossExTurn,
    );
    ok = ok && docSession === c.docSession;
    ok =
      ok &&
      wsdaRoundSessionNumber(c.input.phaseIndex) === c.input.phaseIndex + 1;
    const built = buildWsdaOpponentSystemPrompt(c.input);
    ok = ok && built.length > 200;
  }
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failed += 1;
  console.log(`${mark}  resolver: ${c.name}`);
}

const fullConstructive = buildWsdaOpponentSystemPrompt({
  phaseIndex: 2,
  opponentSide: "Con",
});
const contentChecks = [
  {
    name: "doc sections exported",
    ok: [WSDA_CONSTRUCTIVE_PROMPT, WSDA_CROSS_EX_ASK_PROMPT, WSDA_CROSS_EX_ANSWER_PROMPT, WSDA_REBUTTAL_PROMPT, WSDA_CONCLUSION_PROMPT].every(
      (s) => s.length > 80,
    ),
  },
  {
    name: "built prompt includes tips + guardrails",
    ok:
      fullConstructive.includes(WSDA_DEBATE_TIPS.slice(0, 20)) &&
      fullConstructive.includes("typed WSDA chat"),
  },
];

for (const c of contentChecks) {
  const mark = c.ok ? "PASS" : "FAIL";
  if (!c.ok) failed += 1;
  console.log(`${mark}  ${c.name}`);
}

if (failed > 0) {
  process.exitCode = 1;
  console.log(`\n${failed} check(s) failed.`);
} else {
  console.log(
    `\nAll ${staticChecks.length + segmentCases.length + contentChecks.length} checks passed.`,
  );
}
