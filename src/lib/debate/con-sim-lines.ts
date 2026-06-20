/** Simulated opponent messages when the user plays solo WSDA (demo opponent). */

const CROSS_EX: string[] = [
  "Cross-ex: What is your bright-line test for when your benefit actually occurs?",
  "Question — on your evidence, how large is the effect size versus status quo?",
  "If your main claim fails, what is the next-best reason we should still affirm?",
  "Walk me through the chain: your principle → your outcome in one concrete case.",
  "Under your framework, who bears the burden if costs show up before benefits?",
  "Is your criterion reversible — could the same logic support the opposite side?",
];

const CONSTRUCTIVE: string[] = [
  "I negate: the harms and trade-offs you brushed past outweigh the story you told.",
  "Here are two independent reasons to reject the resolution — scope and enforcement.",
  "Even granting your best case, the countervailing risks make your plan a bad bet.",
  "The resolution over-promises: real institutions move slower than your model assumes.",
  "I will show structural incentives that cut against your claimed benefits.",
];

const CROSS_EX_ANSWER_CON: string[] = [
  "Math still helps in the long run — daily skills like measuring and problem-solving build the foundation for harder jobs and school later.",
  "Even long-term success needs basic math first; art is fun, but math is what we use in real life every day.",
  "That question assumes art alone builds the future — we still need math for science, money, and solving everyday problems as adults.",
];

const CROSS_EX_ANSWER_PRO: string[] = [
  "Art builds creativity that helps long-term innovation — math drills alone do not teach the imagination kids need for big ideas.",
  "Daily math is not the only long-run skill — art teaches creative thinking that helps in science and problem-solving too.",
  "Your daily-life frame ignores how art shapes confidence and creative thinking that pays off for years.",
];
const CON_OTHER: string[] = [
  "Con continues: tying this back to the core clash on impacts versus values.",
  "From the Con side: your last point does not resolve the incentive problem I raised.",
  "Con: even if sympathetic, your line still loses on comparative outcomes.",
];

const CON_REBUTTAL: string[] = [
  "Your constructive framework collapses once we weigh enforcement costs — your impacts assume perfect compliance.",
  "In cross-ex you conceded timing problems; that undercuts the Pro case even if your definitions sound fair.",
  "I am not opening a new case — I am showing your two main warrants fail on scope and comparative outcomes.",
];

const PRO_REBUTTAL: string[] = [
  "Your Con constructive overstates harms and ignores the status quo harms we solve — your framework is incomplete.",
  "Under cross-examination your key claim did not survive scrutiny on evidence and implementation.",
  "Even accepting your definitions, Pro still wins on net benefits and the burden you never met.",
];

const PRO_CONSTRUCTIVE: string[] = [
  "I affirm: the resolution holds under clear definitions, a principled framework, and concrete impacts.",
  "Pro constructive: we win on scope — the plan delivers benefits without the harms Con will exaggerate.",
  "Affirming with two independent reasons — institutional feasibility and measurable outcomes.",
  "The resolution is true because status quo failure costs more than the transition you fear.",
];

const PRO_OTHER: string[] = [
  "Pro continues: your last point does not answer the comparative impact I laid out.",
  "From the Pro side: even under your framing, we still win on net benefits.",
  "Pro: tying this back to the core clash — your standard cannot exclude our harms.",
];

export function pickConSimLine(
  phaseIndex: number,
  crossExTurn?: "ask" | "answer",
): string {
  const pools =
    phaseIndex === 1
      ? crossExTurn === "answer"
        ? CROSS_EX_ANSWER_CON
        : CROSS_EX
      : phaseIndex === 2
        ? CONSTRUCTIVE
        : phaseIndex === 3 && crossExTurn === "answer"
          ? CROSS_EX_ANSWER_CON
          : phaseIndex === 5 || phaseIndex === 6 || phaseIndex === 8 || phaseIndex === 9
            ? CON_REBUTTAL
            : CON_OTHER;
  const i = Math.floor(Math.random() * pools.length);
  return pools[i] ?? pools[0];
}

export function pickProSimLine(
  phaseIndex: number,
  crossExTurn?: "ask" | "answer",
): string {
  const pools =
    phaseIndex === 3
      ? crossExTurn === "answer"
        ? CROSS_EX_ANSWER_PRO
        : CROSS_EX
      : phaseIndex === 0
        ? PRO_CONSTRUCTIVE
        : phaseIndex === 1 && crossExTurn === "answer"
          ? CROSS_EX_ANSWER_PRO
          : phaseIndex === 5 || phaseIndex === 6 || phaseIndex === 8 || phaseIndex === 9
            ? PRO_REBUTTAL
            : PRO_OTHER;
  const i = Math.floor(Math.random() * pools.length);
  return pools[i] ?? pools[0];
}

/** Fallback line when AI opponent is unavailable in solo WSDA. */
export function pickOpponentSimLine(
  phaseIndex: number,
  opponentRole: "pro" | "con",
  crossExTurn?: "ask" | "answer",
): string {
  return opponentRole === "con"
    ? pickConSimLine(phaseIndex, crossExTurn)
    : pickProSimLine(phaseIndex, crossExTurn);
}
