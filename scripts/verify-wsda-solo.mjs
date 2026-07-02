/**
 * Smoke checks for solo WSDA schedule and session wiring.
 * Run: node scripts/verify-wsda-solo.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const scheduleSrc = read("src/lib/debate/wsda-schedule.ts");
const phaseBlocks = scheduleSrc.match(/label:\s*"[^"]+"/g) ?? [];
const phaseCount = phaseBlocks.length;
const totalSec = [...scheduleSrc.matchAll(/durationSec:\s*(\d+)/g)].reduce(
  (sum, m) => sum + Number(m[1]),
  0,
);

const checks = [
  {
    name: "10 WSDA phases defined",
    ok: phaseCount === 10,
    detail: `found ${phaseCount}`,
  },
  {
    name: "Total round ~16 minutes",
    ok: totalSec === 960,
    detail: `${totalSec}s`,
  },
  {
    name: "Conclusion speech labels",
    ok:
      scheduleSrc.includes("Pro Conclusion Speech") &&
      scheduleSrc.includes("Con Conclusion Speech"),
    detail: "labels present",
  },
  {
    name: "SoloDebateTimeoutTimer removed",
    ok: !read("src/app/debate/page.tsx").includes("SoloDebateTimeoutTimer"),
    detail: "not imported in debate page",
  },
  {
    name: "Solo path always builds WSDA session",
    ok: (() => {
      const repo = read("src/lib/data/repository.ts");
      const fn = repo.slice(
        repo.indexOf("export function getDebateSessionForTopic"),
        repo.indexOf("/** Live arena room"),
      );
      return (
        fn.includes("return buildWsdaSession(rawTitle, selectedRole)") &&
        !fn.includes("free_form") &&
        !fn.includes("soloDurationSeconds")
      );
    })(),
    detail: "getDebateSessionForTopic",
  },
  {
    name: "Topics links include format=wsda",
    ok: read("src/app/topics/page.tsx").includes("format=wsda"),
    detail: "topics page",
  },
  {
    name: "Phase-aware opponent API fields",
    ok:
      read("src/app/api/ai/opponent-reply/route.ts").includes("phaseIndex") &&
      read("src/lib/llm/tasks.ts").includes("buildWsdaOpponentSystemPrompt"),
    detail: "LLM + route + docx prompts",
  },
  {
    name: "Prep phases lock typing (userMaySpeak none)",
    ok: scheduleSrc.includes('activeSpeaker: "none"'),
    detail: "prep segments",
  },
];

let failed = 0;
for (const c of checks) {
  const mark = c.ok ? "PASS" : "FAIL";
  if (!c.ok) failed += 1;
  console.log(`${mark}  ${c.name} (${c.detail})`);
}

if (failed > 0) {
  process.exitCode = 1;
  console.log(`\n${failed} check(s) failed.`);
} else {
  console.log(`\nAll ${checks.length} checks passed.`);
}
