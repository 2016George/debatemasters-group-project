import { NextResponse } from "next/server";
import { buildLocalAiJudgedResult } from "@/lib/data/ai-results";
import type { AgeBand, DebateResult, DebateTranscriptEntry, DebateResultScores } from "@/lib/data/types";
import { judgeDebateAndFeedback, type JudgeDebateOutput } from "@/lib/llm/tasks";
import { buildLowContentWsdaJudgeScores } from "@/lib/llm/wsda-judge-parse";
import {
  computeDebateExperienceReward,
  progressionFieldsAfterMatch,
} from "@/lib/progression/experience";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";

type FinalizeDebateBody = {
  sessionId?: unknown;
  topicTitle?: unknown;
  userRole?: unknown;
  debateFormat?: unknown;
  arenaRoomId?: unknown;
  ageBand?: unknown;
  transcript?: unknown;
};

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

function hasSufficientDebateContent(transcript: DebateTranscriptEntry[]): boolean {
  const debaterMessages = transcript.filter((entry) => {
    const speaker = entry.speaker.trim().toLowerCase();
    if (speaker === "system") return false;
    return entry.text.trim().length >= 16;
  });
  return debaterMessages.length >= 2;
}

function lowContentFallbackFeedback(ageBand: AgeBand): string {
  if (ageBand === "under10") {
    return "Time ended before both sides shared enough ideas to judge the round fairly. Next time, try adding at least one clear reason and one example.";
  }
  if (ageBand === "10-14") {
    return "The timer ended before enough arguments were exchanged for detailed judging. Next round, make sure both sides share clear claims and at least one supporting example.";
  }
  if (ageBand === "15-18") {
    return "The round ended without enough substantive arguments for detailed adjudication. In the next round, each side should present clear warrants and comparative impacts.";
  }
  return "The round concluded without enough substantive clash for detailed adjudication. In the next round, both sides should provide developed claims, warrants, and impact comparison.";
}

function applyLowContentJudgementFallback(
  judgement: JudgeDebateOutput,
  ageBand: AgeBand,
  debateFormat?: "wsda" | "free_form",
): JudgeDebateOutput {
  const sharedFeedback = lowContentFallbackFeedback(ageBand);
  const sharedQuote =
    ageBand === "under10"
      ? "Short, clear reasons help judges understand your side."
      : "Clear claims plus evidence create judgeable rounds.";
  return {
    ...judgement,
    rationale: "Insufficient substantive debate content for full rationale.",
    feedback: sharedFeedback,
    quote: sharedQuote,
    scores:
      debateFormat === "wsda"
        ? buildLowContentWsdaJudgeScores()
        : { clarity: 1.5, evidence: 1.5 },
  };
}

async function persistArenaJudgement(input: {
  arenaRoomId: string;
  topicTitle: string;
  userRole: "pro" | "con";
  debateFormat?: "wsda" | "free_form";
  transcript: DebateTranscriptEntry[];
  judge: {
    winner: "pro" | "con";
    confidence: number;
    rationale: string;
    pro: Awaited<ReturnType<typeof judgeDebateAndFeedback>>;
    con: Awaited<ReturnType<typeof judgeDebateAndFeedback>>;
  };
}): Promise<DebateResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Must be authenticated to finalize arena debates.");
  }

  const judgementPayload = {
    topic_title: input.topicTitle,
    debate_format: input.debateFormat ?? null,
    transcript: input.transcript,
    winner_side: input.judge.winner,
    confidence: input.judge.confidence,
    rationale: input.judge.rationale,
    feedback: input.judge.pro.feedback,
    quote: input.judge.pro.quote,
    clarity_score: input.judge.pro.scores.clarity,
    evidence_score: input.judge.pro.scores.evidence,
    pro_feedback: input.judge.pro.feedback,
    pro_quote: input.judge.pro.quote,
    pro_clarity_score: input.judge.pro.scores.clarity,
    pro_evidence_score: input.judge.pro.scores.evidence,
    pro_wsda: input.judge.pro.scores.wsda ?? null,
    con_feedback: input.judge.con.feedback,
    con_quote: input.judge.con.quote,
    con_clarity_score: input.judge.con.scores.clarity,
    con_evidence_score: input.judge.con.scores.evidence,
    con_wsda: input.judge.con.scores.wsda ?? null,
  };
  const { data, error } = await supabase.rpc("arena_store_judged_result", {
    p_room: input.arenaRoomId,
    p_judgement: judgementPayload,
  });
  if (error) {
    const msg = error.message ?? "Failed to store judged result.";
    if (msg.includes("arena_store_judged_result")) {
      throw new Error(
        "Arena judge RPC is missing in this database. Apply latest Supabase migrations and retry.",
      );
    }
    throw new Error(msg);
  }
  const row = data as {
    status?: string;
    payload?: DebateResult;
    message?: string;
  };
  if (row?.status === "error") {
    throw new Error(row.message ?? "Failed to store judged result.");
  }
  if (!row?.payload || typeof row.payload !== "object") {
    throw new Error("Arena judged result payload missing.");
  }
  const payload = row.payload as DebateResult;
  const sideJudgement =
    input.userRole === "con" ? input.judge.con : input.judge.pro;
  const mergedScores: DebateResultScores = {
    clarity: sideJudgement.scores.clarity,
    evidence: sideJudgement.scores.evidence,
    ...(sideJudgement.scores.wsda
      ? { wsda: sideJudgement.scores.wsda }
      : {}),
  };
  const { data: prof } = await supabase
    .from("profiles")
    .select("total_experience")
    .eq("id", user.id)
    .maybeSingle();
  const totalAfter = Number(prof?.total_experience ?? 0);
  const xpEarned = computeDebateExperienceReward({
    outcome: payload.outcome,
    arenaRoomId: input.arenaRoomId,
    scores: mergedScores,
  });
  const before = Math.max(0, totalAfter - xpEarned);
  const prog = progressionFieldsAfterMatch({
    totalExperienceBefore: before,
    outcome: payload.outcome,
    arenaRoomId: input.arenaRoomId,
    scores: mergedScores,
  });
  return {
    ...payload,
    ...prog,
    scores: mergedScores,
    feedback: `${sideJudgement.feedback} Decision rationale: ${input.judge.rationale}`,
    quote: sideJudgement.quote,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinalizeDebateBody;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const topicTitle = typeof body.topicTitle === "string" ? body.topicTitle.trim() : "";
    const userRole = body.userRole === "con" ? "con" : "pro";
    const debateFormat =
      body.debateFormat === "wsda" || body.debateFormat === "free_form"
        ? body.debateFormat
        : undefined;
    const ageBand = normalizeAgeBand(body.ageBand);
    const arenaRoomId =
      typeof body.arenaRoomId === "string" ? body.arenaRoomId.trim() : "";
    const transcript = normalizeTranscript(body.transcript);
    const hasEnoughContent = hasSufficientDebateContent(transcript);

    if (!sessionId || !topicTitle) {
      return NextResponse.json(
        { ok: false, error: "sessionId and topicTitle are required." },
        { status: 400 },
      );
    }
    if (transcript.length === 0) {
      return NextResponse.json(
        { ok: false, error: "transcript is required." },
        { status: 400 },
      );
    }

    if (!arenaRoomId) {
      let soloJudgement = await judgeDebateAndFeedback({
        topicTitle,
        debateFormat,
        userRole,
        ageBand,
        transcript,
      });
      if (!hasEnoughContent) {
        soloJudgement = applyLowContentJudgementFallback(
          soloJudgement,
          ageBand,
          debateFormat,
        );
      }

      let totalExperienceBefore = 0;
      try {
        const supabase = await createServerSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("total_experience")
            .eq("id", user.id)
            .maybeSingle();
          totalExperienceBefore = Number(prof?.total_experience ?? 0);
        }
      } catch {
        /* guest or missing Supabase env */
      }

      const result = buildLocalAiJudgedResult({
        sessionId,
        topicTitle,
        userRole,
        transcript,
        debateFormat,
        judgement: {
          winner: soloJudgement.winner,
          confidence: soloJudgement.confidence,
          rationale: soloJudgement.rationale,
          feedback: soloJudgement.feedback,
          quote: soloJudgement.quote,
          scores: soloJudgement.scores,
        },
        totalExperienceBefore,
      });

      return NextResponse.json({
        ok: true,
        persisted: false,
        result,
      });
    }

    let [judgementForPro, judgementForCon] = await Promise.all([
      judgeDebateAndFeedback({
        topicTitle,
        debateFormat,
        userRole: "pro",
        ageBand,
        transcript,
      }),
      judgeDebateAndFeedback({
        topicTitle,
        debateFormat,
        userRole: "con",
        ageBand,
        transcript,
      }),
    ]);
    if (!hasEnoughContent) {
      judgementForPro = applyLowContentJudgementFallback(
        judgementForPro,
        ageBand,
        debateFormat,
      );
      judgementForCon = applyLowContentJudgementFallback(
        judgementForCon,
        ageBand,
        debateFormat,
      );
    }

    let winner: "pro" | "con";
    let confidence: number;
    if (judgementForPro.winner === judgementForCon.winner) {
      winner = judgementForPro.winner;
      confidence = Math.max(
        judgementForPro.confidence,
        judgementForCon.confidence,
      );
    } else if (judgementForPro.confidence >= judgementForCon.confidence) {
      winner = judgementForPro.winner;
      confidence = judgementForPro.confidence;
    } else {
      winner = judgementForCon.winner;
      confidence = judgementForCon.confidence;
    }
    const mergedRationale = `Pro-view rationale: ${judgementForPro.rationale} Con-view rationale: ${judgementForCon.rationale}`;
    const judgement = {
      winner,
      confidence,
      rationale: mergedRationale,
      pro: judgementForPro,
      con: judgementForCon,
    };

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Arena judging requires Supabase configuration." },
        { status: 500 },
      );
    }
    const payload = await persistArenaJudgement({
      arenaRoomId,
      topicTitle,
      userRole,
      debateFormat,
      transcript,
      judge: judgement,
    });
    return NextResponse.json({
      ok: true,
      persisted: true,
      result: payload,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to finalize debate.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
