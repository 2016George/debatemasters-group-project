"use client";

import { useSyncExternalStore } from "react";
import { mockDebateHistory } from "@/lib/data/mock/fixtures";
import type { DebateResult, DebateTranscriptEntry } from "@/lib/data/types";
import {
  applyGuestExperienceDelta,
  refreshUserProfileFromServer,
} from "@/lib/data/profile-storage";
import {
  computeDebateExperienceReward,
  progressionFieldsAfterMatch,
} from "@/lib/progression/experience";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser-client";

export const HISTORY_STORAGE_KEY = "debate-history-v1";
const HISTORY_HIDDEN_IDS_KEY = "debate-history-hidden-ids-v1";
const ACTIVE_TRANSCRIPT_PREFIX = "debate-active-transcript:";
const LATEST_ACTIVE_TRANSCRIPT_KEY = "debate-active-transcript:latest";
/** In-memory fallback when localStorage is blocked or session id changes after remount. */
const activeTranscriptMemory = new Map<string, DebateTranscriptEntry[]>();
let latestActiveTranscript: {
  sessionId: string;
  transcript: DebateTranscriptEntry[];
} | null = null;
const historyListeners = new Set<() => void>();
/** Stable snapshot while auth-backed history is loading — `[]` literals break useSyncExternalStore. */
const EMPTY_DEBATE_HISTORY: DebateResult[] = [];
let cachedStorageRaw: string | null = null;
let cachedHistorySnapshot: DebateResult[] | null = null;

let sessionMode: "unknown" | "guest" | "authed" = "unknown";
let fetchingAuthed = false;
let supabaseHistoryRows: DebateResult[] | null = null;
let resolveStarted = false;
let authHistoryHooked = false;

function notifyHistoryListeners(): void {
  historyListeners.forEach((listener) => listener());
}

export type ForfeitMeta = {
  sessionId: string;
  topicTitle: string;
  opponentName: string;
  userRole?: "pro" | "con";
  debateFormat?: "wsda" | "free_form";
  /** Supabase `debate_rooms.id` — used for stable result IDs and server forfeit RPC. */
  arenaRoomId?: string;
  /** Current user id (optional; enables stable `debate_results` id for arena forfeits). */
  selfUserId?: string;
  /** For progression preview on the result card (guest + pre-save). */
  totalExperienceBefore?: number;
};

function fallbackTranscript(
  result: Pick<DebateResult, "topicTitle" | "headline" | "subline" | "debatedAt">,
): DebateTranscriptEntry[] {
  return [
    {
      speaker: "System",
      text: `Debate opened: ${result.topicTitle}`,
      at: result.debatedAt,
    },
    {
      speaker: "System",
      text: `${result.headline} — ${result.subline}`,
      at: result.debatedAt,
    },
  ];
}

export function normalizeDebateResult(value: DebateResult): DebateResult {
  const scores = value.scores ?? { clarity: 0, evidence: 0 };
  return {
    ...value,
    scores: {
      clarity: Number(scores.clarity ?? 0),
      evidence: Number(scores.evidence ?? 0),
      ...(scores.wsda ? { wsda: scores.wsda } : {}),
    },
    transcript:
      Array.isArray(value.transcript) && value.transcript.length > 0
        ? value.transcript
        : fallbackTranscript(value),
  };
}

function isDebateResult(value: unknown): value is DebateResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.topicTitle === "string" &&
    typeof v.debatedAt === "string" &&
    (v.outcome === "victory" || v.outcome === "effort" || v.outcome === "forfeit") &&
    typeof v.headline === "string" &&
    typeof v.subline === "string"
  );
}

export function readStoredDebateHistory(): DebateResult[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDebateResult).map(normalizeDebateResult);
  } catch {
    return [];
  }
}

function writeStoredDebateHistory(history: DebateResult[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  notifyHistoryListeners();
}

function readHiddenDebateIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(HISTORY_HIDDEN_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeHiddenDebateIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_HIDDEN_IDS_KEY, JSON.stringify([...ids]));
}

function mergeLocalAndMock(): DebateResult[] {
  const stored = readStoredDebateHistory();
  const hiddenIds = readHiddenDebateIds();
  const existingIds = new Set(stored.map((r) => r.id));
  const merged = [
    ...stored.filter((r) => !hiddenIds.has(r.id)),
    ...mockDebateHistory
      .filter((r) => !existingIds.has(r.id) && !hiddenIds.has(r.id))
      .map(normalizeDebateResult),
  ];
  return merged.sort((a, b) => +new Date(b.debatedAt) - +new Date(a.debatedAt));
}

function mergeServerSide(): DebateResult[] {
  const stored: DebateResult[] = [];
  const hiddenIds = new Set<string>();
  const existingIds = new Set(stored.map((r) => r.id));
  const merged = [
    ...stored.filter((r) => !hiddenIds.has(r.id)),
    ...mockDebateHistory
      .filter((r) => !existingIds.has(r.id) && !hiddenIds.has(r.id))
      .map(normalizeDebateResult),
  ];
  return merged.sort((a, b) => +new Date(b.debatedAt) - +new Date(a.debatedAt));
}

async function resolveHistoryFromAuth(): Promise<void> {
  if (!isSupabaseConfigured()) {
    sessionMode = "guest";
    supabaseHistoryRows = null;
    fetchingAuthed = false;
    notifyHistoryListeners();
    return;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    sessionMode = "guest";
    supabaseHistoryRows = null;
    fetchingAuthed = false;
    notifyHistoryListeners();
    return;
  }

  sessionMode = "authed";
  fetchingAuthed = true;
  notifyHistoryListeners();

  const { data, error } = await supabase
    .from("debate_results")
    .select("payload, arena_room_id")
    .eq("user_id", session.user.id)
    .eq("hidden", false)
    .order("debated_at", { ascending: false });

  fetchingAuthed = false;
  if (error) {
    supabaseHistoryRows = [];
  } else {
    supabaseHistoryRows = (data ?? []).map((row) => {
      const payload = row.payload as DebateResult;
      const arenaRoomId =
        (row as { arena_room_id?: string | null }).arena_room_id ??
        payload.arenaRoomId;
      return normalizeDebateResult(
        arenaRoomId ? { ...payload, arenaRoomId } : payload,
      );
    });
  }
  notifyHistoryListeners();
}

function ensureHistoryAuthListener(): void {
  if (authHistoryHooked || !isSupabaseConfigured()) return;
  authHistoryHooked = true;
  const supabase = createClient();
  supabase.auth.onAuthStateChange(() => {
    sessionMode = "unknown";
    supabaseHistoryRows = null;
    resolveStarted = false;
    void ensureHistoryResolved();
  });
}

async function ensureHistoryResolved(): Promise<void> {
  if (resolveStarted) return;
  resolveStarted = true;
  try {
    await resolveHistoryFromAuth();
  } catch {
    resolveStarted = false;
    sessionMode = "guest";
    supabaseHistoryRows = null;
    notifyHistoryListeners();
  }
}

export async function appendDebateResultToHistory(
  result: DebateResult,
): Promise<DebateResult[]> {
  const normalized = normalizeDebateResult(result);

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const insertRow: Record<string, unknown> = {
        id: normalized.id,
        user_id: session.user.id,
        payload: normalized as unknown as Record<string, unknown>,
        debated_at: normalized.debatedAt,
        hidden: false,
      };
      if (normalized.arenaRoomId) {
        insertRow.arena_room_id = normalized.arenaRoomId;
      }
      const { error } = await supabase.from("debate_results").insert(insertRow);
      if (error) {
        console.warn("appendDebateResultToHistory:", error.message);
      } else {
        void refreshUserProfileFromServer();
      }
      sessionMode = "authed";
      fetchingAuthed = false;
      if (supabaseHistoryRows) {
        supabaseHistoryRows = [
          normalized,
          ...supabaseHistoryRows.filter((r) => r.id !== normalized.id),
        ].sort((a, b) => +new Date(b.debatedAt) - +new Date(a.debatedAt));
      } else {
        supabaseHistoryRows = [normalized];
      }
      notifyHistoryListeners();
      return getCombinedDebateHistory();
    }
  }

  const current = readStoredDebateHistory();
  const next = [normalized, ...current.filter((r) => r.id !== normalized.id)];
  const hiddenIds = readHiddenDebateIds();
  if (hiddenIds.has(normalized.id)) {
    hiddenIds.delete(normalized.id);
    writeHiddenDebateIds(hiddenIds);
  }
  writeStoredDebateHistory(next);
  applyGuestExperienceDelta(
    computeDebateExperienceReward({
      outcome: normalized.outcome,
      arenaRoomId: normalized.arenaRoomId,
      scores: normalized.scores,
    }),
  );
  return getCombinedDebateHistory();
}

export async function removeDebateResultFromHistory(id: string): Promise<DebateResult[]> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: row } = await supabase
        .from("debate_results")
        .select("arena_room_id")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .maybeSingle();

      const arenaRoomId = row?.arena_room_id as string | null | undefined;

      if (arenaRoomId) {
        const { error } = await supabase
          .from("debate_results")
          .update({ hidden: true })
          .eq("id", id)
          .eq("user_id", session.user.id);
        if (error) {
          console.warn("removeDebateResultFromHistory (arena hide):", error.message);
        }
      } else {
        const { error } = await supabase
          .from("debate_results")
          .delete()
          .eq("id", id)
          .eq("user_id", session.user.id);
        if (error) {
          console.warn("removeDebateResultFromHistory (solo delete):", error.message);
        }
      }

      if (supabaseHistoryRows) {
        supabaseHistoryRows = supabaseHistoryRows.filter((r) => r.id !== id);
      }
      notifyHistoryListeners();
      return getCombinedDebateHistory();
    }
  }

  const current = readStoredDebateHistory();
  const next = current.filter((r) => r.id !== id);
  const hiddenIds = readHiddenDebateIds();
  hiddenIds.add(id);
  writeHiddenDebateIds(hiddenIds);
  writeStoredDebateHistory(next);
  return getCombinedDebateHistory();
}

export function getCombinedDebateHistory(): DebateResult[] {
  if (typeof window === "undefined") {
    return mergeServerSide();
  }

  ensureHistoryAuthListener();
  void ensureHistoryResolved();

  if (isSupabaseConfigured() && sessionMode === "authed" && fetchingAuthed) {
    return EMPTY_DEBATE_HISTORY;
  }
  if (isSupabaseConfigured() && sessionMode === "authed" && supabaseHistoryRows !== null) {
    return supabaseHistoryRows;
  }

  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const hiddenRaw = window.localStorage.getItem(HISTORY_HIDDEN_IDS_KEY);
    const cacheKey = `${raw ?? ""}||${hiddenRaw ?? ""}`;
    if (cacheKey === cachedStorageRaw && cachedHistorySnapshot) {
      return cachedHistorySnapshot;
    }
    cachedStorageRaw = cacheKey;
  }

  const sorted = mergeLocalAndMock();
  if (typeof window !== "undefined") {
    cachedHistorySnapshot = sorted;
  }
  return sorted;
}

export function getCombinedDebateResultById(id: string): DebateResult | undefined {
  return getCombinedDebateHistory().find((r) => r.id === id);
}

function parseStoredTranscriptEntries(value: unknown): DebateTranscriptEntry[] {
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
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const normalized: DebateTranscriptEntry = {
        speaker: String(row.speaker),
        text: String(row.text),
        at: String(row.at),
      };
      if (typeof row.phaseIndex === "number" && Number.isFinite(row.phaseIndex)) {
        normalized.phaseIndex = row.phaseIndex;
      }
      return normalized;
    });
}

export function writeActiveDebateTranscript(
  sessionId: string,
  transcript: DebateTranscriptEntry[],
) {
  activeTranscriptMemory.set(sessionId, transcript);
  latestActiveTranscript = { sessionId, transcript };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${ACTIVE_TRANSCRIPT_PREFIX}${sessionId}`,
      JSON.stringify(transcript),
    );
    window.localStorage.setItem(
      LATEST_ACTIVE_TRANSCRIPT_KEY,
      JSON.stringify({ sessionId, transcript }),
    );
  } catch {
    /* quota exceeded or storage blocked — memory cache still holds transcript */
  }
}

export function readActiveDebateTranscript(sessionId: string): DebateTranscriptEntry[] {
  const fromMemory = activeTranscriptMemory.get(sessionId);
  if (fromMemory && fromMemory.length > 0) {
    return fromMemory;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(`${ACTIVE_TRANSCRIPT_PREFIX}${sessionId}`);
      if (raw) {
        const parsed = parseStoredTranscriptEntries(JSON.parse(raw));
        if (parsed.length > 0) {
          activeTranscriptMemory.set(sessionId, parsed);
          return parsed;
        }
      }

      const latestRaw = window.localStorage.getItem(LATEST_ACTIVE_TRANSCRIPT_KEY);
      if (latestRaw) {
        const latest = JSON.parse(latestRaw) as {
          sessionId?: string;
          transcript?: unknown;
        };
        const parsed = parseStoredTranscriptEntries(latest.transcript);
        if (parsed.length > 0) {
          activeTranscriptMemory.set(sessionId, parsed);
          if (latest.sessionId && latest.sessionId !== sessionId) {
            activeTranscriptMemory.set(latest.sessionId, parsed);
          }
          return parsed;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  if (
    latestActiveTranscript?.transcript.length &&
    (latestActiveTranscript.sessionId === sessionId ||
      latestActiveTranscript.transcript.length > 0)
  ) {
    return latestActiveTranscript.transcript;
  }

  return [];
}

function subscribeToHistory(callback: () => void): () => void {
  historyListeners.add(callback);
  void ensureHistoryResolved();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HISTORY_STORAGE_KEY) return;
    callback();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    historyListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useCombinedDebateHistory(): DebateResult[] {
  return useSyncExternalStore(
    subscribeToHistory,
    getCombinedDebateHistory,
    () => mockDebateHistory,
  );
}

export function createForfeitResult(meta: ForfeitMeta): DebateResult {
  const now = new Date();
  const yourSide = meta.userRole === "pro" ? "Pro" : "Con";
  const opponentSide = yourSide === "Pro" ? "Con" : "Pro";
  const formatTag = meta.debateFormat === "wsda" ? "WSDA" : "Standard";
  const id =
    meta.arenaRoomId && meta.selfUserId
      ? `forfeit_${meta.arenaRoomId}_${meta.selfUserId}`
      : `forfeit_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

  const activeTranscript = readActiveDebateTranscript(meta.sessionId);
  const transcript =
    activeTranscript.length > 0
      ? activeTranscript
      : [
          {
            speaker: "System",
            text: `Debate opened: ${meta.topicTitle}`,
            at: now.toISOString(),
          },
          {
            speaker: "System",
            text: "Debate ended immediately because End was clicked.",
            at: now.toISOString(),
          },
        ];

  transcript.push({
    speaker: "System",
    text: `Forfeit recorded. Winner: ${meta.opponentName} (${opponentSide}).`,
    at: now.toISOString(),
  });

  const scores = { clarity: 2.5, evidence: 2.2 };
  const prog = progressionFieldsAfterMatch({
    totalExperienceBefore: meta.totalExperienceBefore ?? 0,
    outcome: "forfeit",
    arenaRoomId: meta.arenaRoomId,
    scores,
  });

  return {
    id,
    ...(meta.arenaRoomId ? { arenaRoomId: meta.arenaRoomId } : {}),
    topicTitle: meta.topicTitle,
    debatedAt: now.toISOString(),
    outcome: "forfeit",
    headline: "DEFEAT BY EARLY EXIT",
    subline: `You ended the debate before the timer finished. ${meta.opponentName} (${opponentSide}) is awarded the win by forfeit.`,
    ...prog,
    feedback:
      `You exited the debate before completion, so the round is recorded as an automatic forfeit loss for your side (${yourSide}). Because the match did not run to time, no final judging comparison is applied. Stay in until the timer ends if you want full AI adjudication and feedback based on complete arguments.`,
    quote:
      "Discipline wins rounds. Stay in until the clock and structure are complete.",
    scores,
    suggestedTomes: [
      {
        title: "Time Control Basics",
        subtitle: "Finish the full structure",
        kind: "rare",
        label: "+2 Focus",
        accent: "primary",
        icon: "menu_book",
      },
      {
        title: "Round Composure I",
        subtitle: "Play the full timer",
        kind: "enchanted",
        label: "+1 Lvl",
        accent: "tertiary",
        icon: "psychology",
      },
    ],
    loot: [{ label: "Consolation Coin x20", tone: "gold" }],
    transcript,
  };
}

export function createJudgingUnavailableResult(
  meta: ForfeitMeta,
  options?: { reason?: string },
): DebateResult {
  const now = new Date();
  const yourSide = meta.userRole === "con" ? "Con" : "Pro";
  const id = `unjudged_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
  const activeTranscript = readActiveDebateTranscript(meta.sessionId);
  const transcript =
    activeTranscript.length > 0
      ? [...activeTranscript]
      : [
          {
            speaker: "System",
            text: `Debate opened: ${meta.topicTitle}`,
            at: now.toISOString(),
          },
        ];

  transcript.push({
    speaker: "System",
    text: "Round completed, but final AI judging was unavailable.",
    at: now.toISOString(),
  });

  const scores = { clarity: 2.8, evidence: 2.8 };
  const prog = progressionFieldsAfterMatch({
    totalExperienceBefore: meta.totalExperienceBefore ?? 0,
    outcome: "effort",
    arenaRoomId: meta.arenaRoomId,
    scores,
  });
  const reason = options?.reason?.trim();
  const reasonSuffix = reason ? ` (${reason})` : "";

  return {
    id,
    topicTitle: meta.topicTitle,
    debatedAt: now.toISOString(),
    outcome: "effort",
    headline: "JUDGING UNAVAILABLE",
    subline: `You completed the round as ${yourSide}, but final adjudication could not be generated.`,
    ...prog,
    feedback:
      `You reached the end of the debate, but the AI judge could not return a final decision this time${reasonSuffix}. Your round is saved as completed effort, not a forfeit.`,
    quote: "Completion counts. Retry adjudication later if available.",
    scores,
    suggestedTomes: [
      {
        title: "Round Reflection",
        subtitle: "Extract your strongest claim",
        kind: "rare",
        label: "+2 Focus",
        accent: "primary",
        icon: "menu_book",
      },
      {
        title: "Resilience Drill I",
        subtitle: "Build consistency under noise",
        kind: "enchanted",
        label: "+1 Lvl",
        accent: "tertiary",
        icon: "psychology",
      },
    ],
    loot: [{ label: "Completion Token x1", tone: "gold" }],
    transcript,
  };
}

/** Opponent wins because the other player ended/forfeited the arena debate. */
export function createOpponentVictoryByForfeitResult(meta: ForfeitMeta): DebateResult {
  const now = new Date();
  const yourSide = meta.userRole === "pro" ? "Pro" : "Con";
  const opponentSide = yourSide === "Pro" ? "Con" : "Pro";
  const formatTag = meta.debateFormat === "wsda" ? "WSDA" : "Standard";
  const id =
    meta.arenaRoomId && meta.selfUserId
      ? `victory_forfeit_${meta.arenaRoomId}_${meta.selfUserId}`
      : `victory_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

  const activeTranscript = readActiveDebateTranscript(meta.sessionId);
  const transcript =
    activeTranscript.length > 0
      ? [...activeTranscript]
      : [
          {
            speaker: "System",
            text: `Debate opened: ${meta.topicTitle}`,
            at: now.toISOString(),
          },
        ];

  transcript.push({
    speaker: "System",
    text: `${meta.opponentName} (${opponentSide}) ended the debate. You win by forfeit.`,
    at: now.toISOString(),
  });

  const scores = { clarity: 4.1, evidence: 3.9 };
  const prog = progressionFieldsAfterMatch({
    totalExperienceBefore: meta.totalExperienceBefore ?? 0,
    outcome: "victory",
    arenaRoomId: meta.arenaRoomId,
    scores,
  });

  return {
    id,
    ...(meta.arenaRoomId ? { arenaRoomId: meta.arenaRoomId } : {}),
    topicTitle: meta.topicTitle,
    debatedAt: now.toISOString(),
    outcome: "victory",
    headline: "VICTORY BY FORFEIT",
    subline: `${meta.opponentName} ended the debate. Your side (${yourSide}) wins.`,
    ...prog,
    feedback: `Your opponent forfeited this ${formatTag} round. You receive the win.`,
    quote: "Presence wins when the room stays fair — finish strong next time too.",
    scores,
    suggestedTomes: [
      {
        title: "Closing Mechanics",
        subtitle: "Seal the round",
        kind: "rare",
        label: "+3 Focus",
        accent: "primary",
        icon: "menu_book",
      },
      {
        title: "Arena Composure II",
        subtitle: "Stay through the bell",
        kind: "enchanted",
        label: "+2 Lvl",
        accent: "tertiary",
        icon: "psychology",
      },
    ],
    loot: [{ label: "Victory Crest x1", tone: "emerald" }],
    transcript,
  };
}
