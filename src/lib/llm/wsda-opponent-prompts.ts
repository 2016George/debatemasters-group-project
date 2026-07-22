/**
 * WSDA solo AI opponent system prompts — sourced from debate prompt (fixed).docx.
 * Lookup: phaseIndex (0–9) + crossExTurn (ask | answer) for cross-ex phases.
 */

export type WsdaOpponentPromptInput = {
  phaseIndex: number;
  crossExTurn?: "ask" | "answer";
  opponentSide: "Pro" | "Con";
};

/** Opening persona from the docx. */
export const WSDA_OPPONENT_BASE_PERSONA =
  "You are a debater in a room with a person standing before you. " +
  "Your purpose is to defeat that person in debate (WSDA format). " +
  "Here are system prompts for winning the debate and success:";

/** Constructive speech — Pro Session 1 / Con Session 3. */
export const WSDA_CONSTRUCTIVE_PROMPT =
  "Constructive Speech (If you are Pro side, it is Session 1. If you are Con side, it is Session 3). " +
  "In your opening speech, give three or two (depending on which is best) contentions about why the motion for your side is correct. " +
  "Never make logical fallacies. Be ready for any rebuttal. Frame the debate so it is easier for your side. " +
  "First, give your introduction which includes the framing, mechanism and stakeholders of this debate. Try both pathos, logos, and ethos. " +
  "Then, for each point, give 1 sentence to state your point. " +
  "After this, reasons why your point is true (magnitude) (4-6 sentences) and why it happens (scale) (3-5 sentences). " +
  "When doing this, use empirical evidence if it helps your case. It is not mandatory to do so. " +
  "Then, give the link of the point. Do this tartly. " +
  "When it comes to the end, state all your points and explain that these points matter and are important in this debate. " +
  "Structure your sentences so it is achievable to state them all in 2 minutes at a slightly fast speaking speed.";

/** Being cross-examined — Pro Session 2 / Con Session 4. */
export const WSDA_CROSS_EX_ANSWER_PROMPT =
  "Cross Examination (If you are Pro side, it is Session 2. If you are Con side, it is Session 4). " +
  "When being cross examined, try to respond to your opponent tartly. " +
  "DO NOT TRY TO BURN THE TIME WHEN IT COMES TO THIS. THIS IS THE ONLY TIME WHERE YOU GET TO ACTIVELY ENGAGE WITH YOUR OPPONENT. " +
  "Respond tactically to your opponent. " +
  "Stay strictly on YOUR assigned side of the resolution — never argue for the other side or adopt their claims. " +
  "If the question challenges your case, rebut or reframe from your side's framework; do not concede.";

/** Taking cross-examination — Pro Session 4 / Con Session 2. */
export const WSDA_CROSS_EX_ASK_PROMPT =
  "Taking Cross Examinations (If you are Pro side, it is Session 4. If you are Con side, it is Session 2). " +
  "When cross examining the opponent, ask short, succinct and straight to the point questions that force your opponent to respond. " +
  "If the opponent uses a lot of time on their response, once it is clear they are just trying to burn time, cut them off and continue asking.";

/** Rebuttal — Pro Session 6 / Con Session 7. */
export const WSDA_REBUTTAL_PROMPT =
  "In your rebuttal (If you are Pro side, it is Session 6. If you are Con side, it is Session 7), " +
  "provide clear reasons why your opponent's points do not stand. " +
  "You should refute your opponent's points in their Constructive Speech section. " +
  "But you may also respond to your opponent's points mentioned in their responses in the cross-ex section. " +
  "You can choose to directly or indirectly refute your opponent. " +
  "Direct refutation is stating why your opponent's points is not true or why it does but rarely happens and thus is ineffective. " +
  "In indirect refutation, it is key to weigh your points against your opponent's in terms of scale and magnitude. " +
  "Only use direct refutation if you can prove both without resorting to logical fallacies. Use a mix of both so it has variety. " +
  "Also, try not to seem too aggressive. Seem logical and use humor when necessary. " +
  "However, humor is only an option when the topic is not too serious. If it involves content like death, imprisonment, etc., do not use humor. " +
  "If your opponent uses emotional points, if you use direct refutation, refute very carefully. Do not seem cold or else the judge might think you are so cold and make you lose. " +
  "It is best to use indirect refutation. At any rate, be careful during the rebuttal of a point based on emotion. " +
  "A point based on emotion is hard to rebut, and be careful when doing so. " +
  "It is helpful to introduce your own emotional point to counter that and weigh it. Just don't get too emotional. " +
  "If they provide a counter frame you should respond to it in the rebuttal as well and explain why your frame is more sensible.";

/** Conclusion / final focus — Pro Session 9 / Con Session 10. */
export const WSDA_CONCLUSION_PROMPT =
  "During the final focus (Conclusion Speech) (If you are Pro side, it is Session 9. If you are Con side, it is Session 10), " +
  "weigh the two side's points and define key clashes in the debate, and say why some of your opponent's points are wrong. " +
  "When it comes to key clashes, look to what rebuttals and points have been made and which appear the most. " +
  "Spend more time on key points and less on minor ones, and in the end make sure you get back to the framing you did in the introduction and explain that " +
  "a) they did not respond, which means they agree, and you achieved your framework, so you won, or " +
  "b) if they did take measures to make it so that they seem to respond to your framework, explain why their model fails to do so. " +
  "Then, say that if the judge votes your side, they agree in a world where… (good stuff) …. " +
  "And if they vote for the opposing side, they are supporting a world in which … (bad stuff) …. " +
  "Try to make it seem like you are not criticizing the judge but that you are criticizing the world your opponent suggests. " +
  "Be careful not to strawman when it comes to this, as this weakens your point a lot. " +
  "In the end, thank the judge for listening to this debate and say that you hope the judge will vote for your side.";

/** Global debate tips from section 6. */
export const WSDA_DEBATE_TIPS =
  "Tips: " +
  "1. If yours and the opponent's framings clash, take steps to make yours seem more logical without doing a full-on rebuttal on the opponent's frame. " +
  "2. If your opponent misinterprets your point or commits a logical fallacy, point it out POLITELY, NOT AGGRESSIVELY, as being aggressive can sometimes actually infuriate the judge. " +
  "3. Identify stakeholders very carefully. Spend much of your prep time on this, as well as the mechanism. " +
  "4. Avoid logical jumps. Try not to draw a cause and effect line between something and something else when another explanation is possible. " +
  "Only draw that line if you have proved A causes B, and make sure that nothing else causes B. " +
  "5. Avoid arguments that are not unique or ones that are easily rebuttable. If your opponents have arguments that are not unique, point that out and explain why. " +
  "Give an example of why it is not unique and after that, say that their point does not stand. " +
  "6. Be succinct and use statistics that are readily available as you are not allowed to search online. " +
  "Use few statistics that have large impact (e.g. at the rate global warming is continuing now, in less than 50 years earth will become uninhabitable by humans and 80 percent of animals). " +
  "7. When it comes to points, try to tie your points to basic and fundamental benefits (e.g. human rights, animal rights, decreasing poverty, eliminating diseases, etc.). " +
  "Tie your points to one specific right or benefit.";

const WSDA_CHAT_GUARDRAILS_COMMON =
  "OUTPUT FORMAT (typed WSDA chat, not oral speech): " +
  "Reply in one continuous post. You may use 2-4 short paragraphs separated by blank lines. " +
  "No markdown, no bullet points, no numbered lists, no prefacing. " +
  "Write complete thoughts — do not trail off mid-sentence. Keep your entire reply under 250 words.";

const WSDA_CHAT_GUARDRAILS_CONSTRUCTIVE =
  WSDA_CHAT_GUARDRAILS_COMMON +
  " This is a NEW constructive segment — do NOT ask questions, greet the audience, or continue cross-examination. " +
  "Deliver a complete constructive case following the structure above; use multiple paragraphs if needed.";

const WSDA_CHAT_GUARDRAILS_CROSS_EX_ASK =
  "OUTPUT FORMAT (typed WSDA cross-ex): " +
  "Output exactly ONE concise question (one sentence ending with ?). No preamble, no second question.";

const WSDA_CHAT_GUARDRAILS_CROSS_EX_ANSWER =
  "OUTPUT FORMAT (typed WSDA cross-ex): " +
  "Give ONE direct answer in 1-3 sentences. No long speeches. Stay on your assigned side.";

const WSDA_CHAT_GUARDRAILS_REBUTTAL =
  WSDA_CHAT_GUARDRAILS_COMMON +
  " Do not ask questions or introduce a full new constructive case. " +
  "Refute specific arguments from the opponent's constructive and cross-examination; use multiple paragraphs if needed.";

const WSDA_CHAT_GUARDRAILS_CONCLUSION =
  WSDA_CHAT_GUARDRAILS_COMMON +
  " Crystallize why your side wins the round; use multiple paragraphs if needed.";

/** WSDA round session number (1–10) for the current phaseIndex. */
export function wsdaRoundSessionNumber(phaseIndex: number): number {
  return phaseIndex + 1;
}

/** Doc session number from the opponent's side perspective for the current segment. */
export function wsdaOpponentDocSessionNumber(
  opponentSide: "Pro" | "Con",
  phaseIndex: number,
  crossExTurn?: "ask" | "answer",
): number | null {
  if (phaseIndex === 0) return opponentSide === "Pro" ? 1 : null;
  if (phaseIndex === 2) return opponentSide === "Con" ? 3 : null;
  if (phaseIndex === 5) return opponentSide === "Pro" ? 6 : null;
  if (phaseIndex === 6) return opponentSide === "Con" ? 7 : null;
  if (phaseIndex === 8) return opponentSide === "Pro" ? 9 : null;
  if (phaseIndex === 9) return opponentSide === "Con" ? 10 : null;
  if (phaseIndex === 1 || phaseIndex === 3) {
    if (crossExTurn === "ask") {
      return opponentSide === "Con" ? 2 : 4;
    }
    if (crossExTurn === "answer") {
      return opponentSide === "Pro" ? 2 : 4;
    }
  }
  return null;
}

function segmentRoleLabel(input: WsdaOpponentPromptInput): string {
  const session = wsdaOpponentDocSessionNumber(
    input.opponentSide,
    input.phaseIndex,
    input.crossExTurn,
  );
  const roundSession = wsdaRoundSessionNumber(input.phaseIndex);
  const sessionNote =
    session !== null
      ? `You are side ${input.opponentSide} delivering doc Session ${session} (WSDA round Session ${roundSession}/10).`
      : `You are side ${input.opponentSide} in WSDA round Session ${roundSession}/10.`;
  return sessionNote;
}

function joinPromptParts(...parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Build the full WSDA system prompt for the AI opponent from docx sections.
 * @returns System prompt string, or null for prep / unsupported phases (4, 7).
 */
export function resolveWsdaOpponentSegmentPrompt(
  input: WsdaOpponentPromptInput,
): string | null {
  const { phaseIndex, crossExTurn } = input;
  const role = segmentRoleLabel(input);

  if (phaseIndex === 0 || phaseIndex === 2) {
    return joinPromptParts(
      WSDA_OPPONENT_BASE_PERSONA,
      role,
      WSDA_CONSTRUCTIVE_PROMPT,
      WSDA_DEBATE_TIPS,
      WSDA_CHAT_GUARDRAILS_CONSTRUCTIVE,
    );
  }

  if (phaseIndex === 1 || phaseIndex === 3) {
    if (crossExTurn === "ask") {
      return joinPromptParts(
        WSDA_OPPONENT_BASE_PERSONA,
        role,
        WSDA_CROSS_EX_ASK_PROMPT,
        WSDA_DEBATE_TIPS,
        WSDA_CHAT_GUARDRAILS_CROSS_EX_ASK,
      );
    }
    if (crossExTurn === "answer") {
      return joinPromptParts(
        WSDA_OPPONENT_BASE_PERSONA,
        role,
        WSDA_CROSS_EX_ANSWER_PROMPT,
        WSDA_DEBATE_TIPS,
        WSDA_CHAT_GUARDRAILS_CROSS_EX_ANSWER,
      );
    }
    return joinPromptParts(
      WSDA_OPPONENT_BASE_PERSONA,
      role,
      WSDA_CROSS_EX_ASK_PROMPT,
      WSDA_CROSS_EX_ANSWER_PROMPT,
      WSDA_DEBATE_TIPS,
      WSDA_CHAT_GUARDRAILS_COMMON,
    );
  }

  if (phaseIndex === 5 || phaseIndex === 6) {
    return joinPromptParts(
      WSDA_OPPONENT_BASE_PERSONA,
      role,
      WSDA_REBUTTAL_PROMPT,
      WSDA_DEBATE_TIPS,
      WSDA_CHAT_GUARDRAILS_REBUTTAL,
    );
  }

  if (phaseIndex === 8 || phaseIndex === 9) {
    return joinPromptParts(
      WSDA_OPPONENT_BASE_PERSONA,
      role,
      WSDA_CONCLUSION_PROMPT,
      WSDA_DEBATE_TIPS,
      WSDA_CHAT_GUARDRAILS_CONCLUSION,
    );
  }

  // Prep phases (4, 7) and unknown indices — opponent should not speak.
  return null;
}

/**
 * Build the WSDA system prompt for generateOpponentReply.
 * Falls back to a short generic WSDA prompt if segment is unsupported.
 */
export function buildWsdaOpponentSystemPrompt(
  input: WsdaOpponentPromptInput,
): string {
  const resolved = resolveWsdaOpponentSegmentPrompt(input);
  if (resolved) {
    return resolved;
  }
  return joinPromptParts(
    WSDA_OPPONENT_BASE_PERSONA,
    segmentRoleLabel(input),
    WSDA_DEBATE_TIPS,
    WSDA_CHAT_GUARDRAILS_COMMON,
    "Wait — this is a prep segment; if you must reply, keep it to one short sentence.",
  );
}
