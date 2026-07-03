"use client";

import {
  appendDebateResultToHistory,
  createJudgingUnavailableResult,
  readActiveDebateTranscript,
  type ForfeitMeta,
} from "@/lib/data/history-storage";
import {
  getAgeBandPreference,
  refreshUserProfileFromServer,
} from "@/lib/data/profile-storage";
import type { DebateResult, DebateTranscriptEntry } from "@/lib/data/types";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";

type FinalizeDebateOutcome =
  | { ok: true; resultId: string }
  | { ok: false; error: string };

type FinalizeDebateResponse = {
  ok?: boolean;
  persisted?: boolean;
  error?: string;
  result?: DebateResult;
};

export async function finalizeDebateWithAi(
  sessionMeta: ForfeitMeta,
  options?: { transcriptOverride?: DebateTranscriptEntry[] },
): Promise<FinalizeDebateOutcome> {
  const transcript =
    options?.transcriptOverride?.length
      ? options.transcriptOverride
      : readActiveDebateTranscript(sessionMeta.sessionId);

  if (transcript.length === 0) {
    return {
      ok: false,
      error:
        "Transcript was not found for this debate. Do not refresh the page — try OK again, or start a new round.",
    };
  }

  const res = await fetch("/api/ai/finalize-debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: sessionMeta.sessionId,
      topicTitle: sessionMeta.topicTitle,
      userRole: sessionMeta.userRole,
      debateFormat: sessionMeta.debateFormat,
      arenaRoomId: sessionMeta.arenaRoomId,
      ageBand: getAgeBandPreference(),
      transcript,
    }),
  });

  const data = (await res.json()) as FinalizeDebateResponse;
  if (!res.ok || !data.ok || !data.result) {
    return {
      ok: false,
      error: data.error ?? "Could not generate AI judgment.",
    };
  }

  if (!data.persisted) {
    await appendDebateResultToHistory(data.result);
  } else if (isSupabaseConfigured()) {
    await refreshUserProfileFromServer();
  }

  return { ok: true, resultId: data.result.id };
}

/** Save a completed round when the judge API fails after retries. */
export async function saveJudgingUnavailableResult(
  sessionMeta: ForfeitMeta,
  reason?: string,
): Promise<FinalizeDebateOutcome> {
  const result = createJudgingUnavailableResult(sessionMeta, { reason });
  await appendDebateResultToHistory(result);
  return { ok: true, resultId: result.id };
}
