import "server-only";
import type { AgeBand, DebateTranscriptEntry, WsdaUserJudgeAssessment } from "@/lib/data/types";
import { getLlmConfig } from "@/lib/llm/env";
import { resolveLlmTask } from "@/lib/llm/provider-registry";
import { parseWsdaJudgeModelOutput } from "@/lib/llm/wsda-judge-parse";
import {
  buildWsdaJudgeSystemPrompt,
  buildWsdaJudgeUserPrompt,
} from "@/lib/llm/wsda-judge-prompts";
import { WSDA_PHASES } from "@/lib/debate/wsda-schedule";
import {
  buildWsdaOpponentSystemPrompt,
  wsdaRoundSessionNumber,
} from "@/lib/llm/wsda-opponent-prompts";

const MAX_OPPONENT_TRANSCRIPT_ITEMS = 36;

export type OpponentReplyRequest = {
  topicTitle: string;
  opponentName: string;
  userRole?: "pro" | "con";
  ageBand?: AgeBand;
  transcript: DebateTranscriptEntry[];
  debateFormat?: "wsda" | "free_form";
  phaseIndex?: number;
  phaseLabel?: string;
  phasePurpose?: string;
  /** Cross-ex only: whether the opponent is asking or answering. */
  crossExTurn?: "ask" | "answer";
};

export type JudgeDebateRequest = {
  topicTitle: string;
  debateFormat?: "wsda" | "free_form";
  userRole?: "pro" | "con";
  ageBand?: AgeBand;
  transcript: DebateTranscriptEntry[];
};

export type GenerateDebateTopicRequest = {
  debateFormat: "wsda" | "free_form";
  ageBand?: AgeBand;
};

export type JudgeDebateOutput = {
  winner: "pro" | "con";
  confidence: number;
  rationale: string;
  feedback: string;
  quote: string;
  scores: {
    clarity: number;
    evidence: number;
    wsda?: WsdaUserJudgeAssessment;
  };
};

function sanitizeTopicLine(raw: string, format: "wsda" | "free_form"): string {
  let value = raw.replace(/[\r\n]+/g, " ").trim();
  value = value.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!value) return "";
  if (format === "wsda") {
    if (!/^this house /i.test(value)) {
      value = `This house believes ${value.replace(/[.?!]+$/, "")}.`;
    } else if (!/[.?!]$/.test(value)) {
      value = `${value}.`;
    }
  } else if (!/[.?!]$/.test(value)) {
    value = `${value}?`;
  }
  return clampText(value, 180);
}

function clampText(value: string, maxLen: number): string {
  const v = value.trim();
  if (v.length <= maxLen) return v;
  return `${v.slice(0, maxLen - 3)}...`;
}

/** Drop a trailing incomplete sentence when the model hits its token limit. */
function trimIncompleteTrailingSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || /[.!?]["']?$/.test(trimmed)) return trimmed;
  const boundaries = [...trimmed.matchAll(/[.!?](?:\s+|$)/g)];
  if (boundaries.length === 0) return trimmed;
  const last = boundaries[boundaries.length - 1];
  if (!last || last.index === undefined) return trimmed;
  const cut = trimmed.slice(0, last.index + 1).trim();
  return cut.length >= trimmed.length * 0.45 ? cut : trimmed;
}

function opponentSideLabel(userRole: "pro" | "con" | undefined): "Pro" | "Con" {
  return userRole === "con" ? "Pro" : "Con";
}

function opponentOutputLimits(input: OpponentReplyRequest): {
  maxTokens: number;
  /** 0 = no character clamp (full model output). */
  maxChars: number;
  trimIncomplete: boolean;
} {
  const phaseIndex = input.phaseIndex;
  if (input.debateFormat !== "wsda" || phaseIndex === undefined) {
    return { maxTokens: 600, maxChars: 0, trimIncomplete: false };
  }
  if (phaseIndex === 0 || phaseIndex === 2) {
    return { maxTokens: 500, maxChars: 0, trimIncomplete: true };
  }
  if (phaseIndex === 5 || phaseIndex === 6) {
    return { maxTokens: 500, maxChars: 0, trimIncomplete: true };
  }
  if (phaseIndex === 8 || phaseIndex === 9) {
    return { maxTokens: 500, maxChars: 0, trimIncomplete: true };
  }
  if (phaseIndex === 1 || phaseIndex === 3) {
    if (input.crossExTurn === "ask") {
      return { maxTokens: 120, maxChars: 320, trimIncomplete: false };
    }
    if (input.crossExTurn === "answer") {
      return { maxTokens: 280, maxChars: 0, trimIncomplete: false };
    }
    return { maxTokens: 200, maxChars: 450, trimIncomplete: false };
  }
  return { maxTokens: 600, maxChars: 0, trimIncomplete: false };
}

function finalizeOpponentReply(text: string, input: OpponentReplyRequest): string {
  const limits = opponentOutputLimits(input);
  let value = text.trim();
  if (limits.trimIncomplete) {
    value = trimIncompleteTrailingSentence(value);
  }
  if (limits.maxChars > 0) {
    return clampText(value, limits.maxChars);
  }
  return value;
}

function renderTranscript(
  entries: DebateTranscriptEntry[],
  opts?: { maxItems?: number },
): string {
  const maxItems = opts?.maxItems;
  const source =
    typeof maxItems === "number" ? entries.slice(-maxItems) : entries;
  return source
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join("\n");
}

function parseJsonFromModel(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON.");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function toBoundedScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(5, Math.max(0, rounded));
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

function calibrateUserScores(input: {
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
    clarity: Math.round(clarity * 10) / 10,
    evidence: Math.round(evidence * 10) / 10,
  };
}

function shouldRetryJudgeError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("temporar") ||
    msg.includes("service unavailable") ||
    msg.includes("gateway") ||
    msg.includes("empty content") ||
    msg.includes("length")
  );
}

async function waitMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type JudgeLlmMessage = {
  role: "system" | "user";
  content: string;
};

async function generateJudgeWithRetries(
  provider: ReturnType<typeof resolveLlmTask>["provider"],
  model: string,
  messages: JudgeLlmMessage[],
  maxTokens: number,
): Promise<string> {
  let responseText = "";
  let lastError: unknown = null;
  const retryBackoffMs = [0, 700, 1400];
  for (let attempt = 0; attempt < retryBackoffMs.length; attempt += 1) {
    if (retryBackoffMs[attempt] > 0) {
      await waitMs(retryBackoffMs[attempt]);
    }
    try {
      const response = await provider.generate({
        model,
        temperature: 0.2,
        maxTokens,
        jsonMode: "json_object",
        messages,
      });
      responseText = response.text;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt === retryBackoffMs.length - 1 || !shouldRetryJudgeError(error)) {
        throw error;
      }
    }
  }
  if (!responseText) {
    throw (lastError instanceof Error
      ? lastError
      : new Error("Judge model returned no response after retries."));
  }
  return responseText;
}

function opponentSystemPrompt(input: OpponentReplyRequest): string {
  const phaseIndex = input.phaseIndex;
  if (input.debateFormat !== "wsda" || phaseIndex === undefined) {
    return "You are an in-character debate opponent. Reply with exactly one short argument paragraph (2-4 sentences), no markdown, no bullet points, no prefacing.";
  }

  return buildWsdaOpponentSystemPrompt({
    phaseIndex,
    crossExTurn: input.crossExTurn,
    opponentSide: opponentSideLabel(input.userRole),
  });
}

function wsdaOpponentTaskInstruction(input: OpponentReplyRequest): string {
  const phaseIndex = input.phaseIndex;
  const userRole = input.userRole === "con" ? "con" : "pro";
  if (phaseIndex === undefined) {
    return "Provide the next persuasive response based on the transcript.";
  }

  if (phaseIndex === 1 || phaseIndex === 3) {
    if (input.crossExTurn === "ask") {
      return "Ask exactly ONE question based on the transcript above. Output only that question.";
    }
    if (input.crossExTurn === "answer") {
      return "Answer the opponent's most recent cross-ex question now, using the transcript above.";
    }
    return "Provide the next cross-examination question or answer as appropriate.";
  }

  if (phaseIndex === 0 || phaseIndex === 2) {
    return "Deliver your constructive speech now, using the transcript above to respond to what the other side has argued. Keep your entire reply under 250 words — be concise, state your best 1-2 contentions only.";
  }

  if (phaseIndex === 5 || phaseIndex === 6) {
    if (userRole === "pro") {
      return (
        `Rebut arguments from "${WSDA_PHASES[0]?.label ?? "Pro Constructive"}" and ` +
        `"${WSDA_PHASES[1]?.label ?? "Con Cross-Examination of the Pro"}" using the transcript above. Keep your entire rebuttal under 250 words.`
      );
    }
    return (
      `Rebut arguments from "${WSDA_PHASES[2]?.label ?? "Con Constructive"}" and ` +
        `"${WSDA_PHASES[3]?.label ?? "Pro Cross-Examination of the Con"}" using the transcript above. Keep your entire rebuttal under 250 words.`
    );
  }

  if (phaseIndex === 8 || phaseIndex === 9) {
    return "Deliver your conclusion speech now, using the full transcript above. Keep your entire conclusion under 250 words.";
  }

  return "Provide the next persuasive response based on the transcript.";
}

function opponentUserPrompt(input: OpponentReplyRequest): string {
  const userSide = input.userRole === "con" ? "Con" : "Pro";
  const opponentSide = userSide === "Pro" ? "Con" : "Pro";
  const parts = [
    `Topic: ${input.topicTitle}`,
    `You are ${input.opponentName}, side ${opponentSide}.`,
    `The user is side ${userSide}.`,
    ageBandToneGuide(input.ageBand),
  ];

  if (
    input.debateFormat === "wsda" &&
    input.phaseIndex !== undefined &&
    input.phaseLabel
  ) {
    const sessionNumber = wsdaRoundSessionNumber(input.phaseIndex);
    parts.push(
      `Current WSDA Session ${sessionNumber}/10: ${input.phaseLabel}${input.phasePurpose ? ` — ${input.phasePurpose}` : ""}.`,
    );
  }

  if (
    input.debateFormat === "wsda" &&
    input.crossExTurn === "answer"
  ) {
    parts.push(
      `Resolution reminder: you are side ${opponentSide} on "${input.topicTitle}". ` +
        `Answer only from ${opponentSide}'s perspective — never argue for ${userSide}.`,
    );
  }

  parts.push(
    input.debateFormat === "wsda" && input.phaseIndex !== undefined
      ? wsdaOpponentTaskInstruction(input)
      : "Continue from the transcript and provide the next persuasive response:",
    "",
    "Transcript so far:",
    renderTranscript(input.transcript, {
      maxItems: MAX_OPPONENT_TRANSCRIPT_ITEMS,
    }),
  );

  return parts.join("\n\n");
}

export async function generateOpponentReply(
  input: OpponentReplyRequest,
): Promise<string> {
  const { provider, model } = resolveLlmTask("opponent");
  const messages = [
    {
      role: "system" as const,
      content: opponentSystemPrompt(input),
    },
    {
      role: "user" as const,
      content: opponentUserPrompt(input),
    },
  ];

  const maxTokens = opponentOutputLimits(input).maxTokens;

  try {
    const response = await provider.generate({
      model,
      temperature: 0.8,
      maxTokens,
      messages,
    });
    return finalizeOpponentReply(response.text, input);
  } catch (primaryError) {
    const cfg = getLlmConfig();
    // If custom opponent model fails, retry once with DeepSeek's stable default chat model.
    if (cfg.opponentModel !== "deepseek-chat") {
      const retry = await provider.generate({
        model: "deepseek-chat",
        temperature: 0.8,
        maxTokens,
        messages,
      });
      return finalizeOpponentReply(retry.text, input);
    }
    throw primaryError;
  }
}

export async function generateDebateTopic(
  input: GenerateDebateTopicRequest,
): Promise<string> {
  const { provider, model } = resolveLlmTask("judge");
  const isWsda = input.debateFormat === "wsda";
  const response = await provider.generate({
    model,
    temperature: 0.9,
    maxTokens: 90,
    messages: [
      {
        role: "system",
        content: isWsda
          ? 'Generate one age-appropriate WSDA resolution. Return one line only in plain text. Format must start with "This house". No numbering, no quotes, no markdown.'
          : "Generate one age-appropriate free-form debate topic as one engaging question. Return one line only in plain text. No numbering, no quotes, no markdown.",
      },
      {
        role: "user",
        content: [
          `Format: ${isWsda ? "WSDA" : "Free Form"}`,
          ageBandToneGuide(input.ageBand),
          "Keep it safe for school settings and avoid explicit, hateful, or self-harm content.",
          "Use clear wording that the selected age group can understand.",
        ].join("\n\n"),
      },
    ],
  });
  return sanitizeTopicLine(response.text, input.debateFormat);
}

export async function judgeDebateAndFeedback(
  input: JudgeDebateRequest,
): Promise<JudgeDebateOutput> {
  if (input.debateFormat === "wsda") {
    return judgeWsdaDebateAndFeedback(input);
  }
  return judgeFreeFormDebateAndFeedback(input);
}

async function judgeWsdaDebateAndFeedback(
  input: JudgeDebateRequest,
): Promise<JudgeDebateOutput> {
  const { provider, model } = resolveLlmTask("judge");
  const userSide = input.userRole === "con" ? "con" : "pro";
  const messages = [
    {
      role: "system" as const,
      content: buildWsdaJudgeSystemPrompt(),
    },
    {
      role: "user" as const,
      content: buildWsdaJudgeUserPrompt({
        topicTitle: input.topicTitle,
        userRole: userSide,
        ageBand: input.ageBand,
        transcript: input.transcript,
      }),
    },
  ];
  const responseText = await generateJudgeWithRetries(provider, model, messages, 4096);
  const parsed = parseJsonFromModel(responseText);
  return parseWsdaJudgeModelOutput(parsed, { userRole: userSide });
}

async function judgeFreeFormDebateAndFeedback(
  input: JudgeDebateRequest,
): Promise<JudgeDebateOutput> {
  const { provider, model } = resolveLlmTask("judge");
  const userSide = input.userRole === "con" ? "con" : "pro";
  const messages = [
    {
      role: "system" as const,
      content:
        "You are a neutral debate judge. Return strict JSON only. Evaluate argument quality and choose one winning side.",
    },
    {
      role: "user" as const,
      content: [
        `Topic: ${input.topicTitle}`,
        `Format: Standard`,
        `User side: ${userSide.toUpperCase()}`,
        ageBandToneGuide(input.ageBand),
        "Evaluate based on the entire transcript provided below.",
        "Transcript:",
        renderTranscript(input.transcript),
        "Return JSON with keys winner, confidence, rationale, feedback, quote, scores.",
        'winner must be "pro" or "con".',
        "confidence is a number 0-1.",
        "scores is an object with numeric clarity and evidence in range 0-5, and these scores must evaluate the USER SIDE only (not the winner, not both sides combined).",
        "Scoring rubric: 5 is excellent, 3 is mixed/average, 1 is very weak.",
        "If the user side clearly loses with high confidence, user-side scores should usually be modest rather than high.",
        "feedback should be 2-4 sentences and actionable.",
        "feedback tone and vocabulary must match the audience age guidance above.",
        "quote should be one memorable sentence.",
      ].join("\n\n"),
    },
  ];
  const responseText = await generateJudgeWithRetries(provider, model, messages, 900);
  const parsed = parseJsonFromModel(responseText);
  const winner = parsed.winner === "con" ? "con" : "pro";
  const confidenceRaw =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? parsed.confidence
      : 0.65;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));
  const scores = (parsed.scores as Record<string, unknown> | undefined) ?? {};
  const rawClarity = toBoundedScore(scores.clarity, 3.5);
  const rawEvidence = toBoundedScore(scores.evidence, 3.5);
  const calibrated = calibrateUserScores({
    userRole: userSide,
    winner,
    confidence,
    clarity: rawClarity,
    evidence: rawEvidence,
  });

  return {
    winner,
    confidence,
    rationale: clampText(String(parsed.rationale ?? "Decision generated by AI judge."), 480),
    feedback: clampText(
      String(
        parsed.feedback ??
          "Maintain clear claim-warrant-impact structure and reinforce each point with direct evidence.",
      ),
      900,
    ),
    quote: clampText(String(parsed.quote ?? "A strong case wins when claims meet proof."), 220),
    scores: {
      clarity: calibrated.clarity,
      evidence: calibrated.evidence,
    },
  };
}
