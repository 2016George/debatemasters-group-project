import { NextResponse } from "next/server";
import type { AgeBand, DebateTranscriptEntry } from "@/lib/data/types";
import { generateOpponentReply } from "@/lib/llm/tasks";

type OpponentReplyBody = {
  topicTitle?: unknown;
  opponentName?: unknown;
  userRole?: unknown;
  ageBand?: unknown;
  transcript?: unknown;
  debateFormat?: unknown;
  phaseIndex?: unknown;
  phaseLabel?: unknown;
  phasePurpose?: unknown;
  crossExTurn?: unknown;
};

function normalizeDebateFormat(value: unknown): "wsda" | "free_form" | undefined {
  if (value === "wsda" || value === "free_form") return value;
  return undefined;
}

function normalizeCrossExTurn(value: unknown): "ask" | "answer" | undefined {
  return value === "ask" || value === "answer" ? value : undefined;
}

function normalizePhaseIndex(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

function normalizeAgeBand(value: unknown): AgeBand {
  return value === "under10" ||
    value === "10-14" ||
    value === "15-18" ||
    value === "18+"
    ? value
    : "10-14";
}

function normalizeTranscriptEntry(entry: Record<string, unknown>): DebateTranscriptEntry {
  const row: DebateTranscriptEntry = {
    speaker: String(entry.speaker),
    text: String(entry.text),
    at: String(entry.at),
  };
  const phaseIndex = entry.phaseIndex;
  if (typeof phaseIndex === "number" && Number.isFinite(phaseIndex)) {
    row.phaseIndex = phaseIndex;
  }
  return row;
}

function normalizeTranscript(value: unknown): DebateTranscriptEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).speaker === "string" &&
        typeof (entry as Record<string, unknown>).text === "string" &&
        typeof (entry as Record<string, unknown>).at === "string",
    )
    .map((entry) => normalizeTranscriptEntry(entry as Record<string, unknown>));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OpponentReplyBody;
    const topicTitle = typeof body.topicTitle === "string" ? body.topicTitle.trim() : "";
    const opponentName =
      typeof body.opponentName === "string" ? body.opponentName.trim() : "Opponent";
    const userRole = body.userRole === "con" ? "con" : "pro";
    const ageBand = normalizeAgeBand(body.ageBand);
    const transcript = normalizeTranscript(body.transcript);
    const debateFormat = normalizeDebateFormat(body.debateFormat);
    const phaseIndex = normalizePhaseIndex(body.phaseIndex);
    const phaseLabel =
      typeof body.phaseLabel === "string" ? body.phaseLabel.trim() : undefined;
    const phasePurpose =
      typeof body.phasePurpose === "string" ? body.phasePurpose.trim() : undefined;
    const crossExTurn = normalizeCrossExTurn(body.crossExTurn);

    if (!topicTitle) {
      return NextResponse.json(
        { ok: false, error: "topicTitle is required." },
        { status: 400 },
      );
    }

    const reply = await generateOpponentReply({
      topicTitle,
      opponentName,
      userRole,
      ageBand,
      transcript,
      debateFormat,
      phaseIndex,
      phaseLabel,
      phasePurpose,
      crossExTurn,
    });

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate opponent reply.";
    console.error("opponent-reply route failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
