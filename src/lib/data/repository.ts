/**
 * Data access layer — swap implementations when moving from mock → Supabase + Vercel.
 *
 * 1. Install `@supabase/supabase-js`.
 * 2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 * 3. Implement the Supabase-backed functions below and branch on env in each export.
 */
import {
  mockDebateHistory,
  mockDebateSession,
  mockTopics,
  mockUser,
} from "./mock/fixtures";
import { formatWsdaResolution } from "../debate/random-match-topics";
import { WSDA_PHASES, formatMmSs, wsdaPhaseBanner } from "../debate/wsda-schedule";
import type {
  DebateResult,
  DebateSession,
  TopicCategory,
  UserProfile,
} from "./types";

const ARENA_OPPONENTS = [
  "CrimsonOrator",
  "NetherKnight_Debate",
  "BlazeBriefBuilder",
  "SoulSandSpeaker",
  "WitherWordsmith",
] as const;

function pickArenaOpponent(): string {
  const i = Math.floor(Math.random() * ARENA_OPPONENTS.length);
  return ARENA_OPPONENTS[i] ?? ARENA_OPPONENTS[0];
}

function parseRequestedRole(
  role: string | null | undefined,
): "pro" | "con" | undefined {
  const v = role?.trim().toLowerCase();
  if (v === "pro" || v === "con") return v;
  return undefined;
}

function buildWsdaSession(
  topicTitle: string,
  preferredRole?: "pro" | "con",
): DebateSession {
  const first = WSDA_PHASES[0];
  const userRole: "pro" | "con" =
    preferredRole ?? (Math.random() < 0.5 ? "pro" : "con");
  return {
    ...mockDebateSession,
    id: `debate_wsda_${Date.now()}`,
    topicTitle: formatWsdaResolution(topicTitle),
    locationLabel: "Solo Path — WSDA",
    phaseLabel: wsdaPhaseBanner(0),
    timerMmSs: first ? formatMmSs(first.durationSec) : "02:00",
    phaseDurationSeconds: first?.durationSec ?? 120,
    debateFormat: "wsda",
    opponentName: pickArenaOpponent(),
    userRole,
  };
}

export function getMockUser(): UserProfile {
  return mockUser;
}

export function getMockTopics(): TopicCategory[] {
  return mockTopics;
}

export function getMockDebateSession(): DebateSession {
  return mockDebateSession;
}

/** Resolves solo WSDA debate session from `/topics` (or custom title). */
export function getDebateSessionForTopic(
  topicId: string | null | undefined,
  customTitle: string | null | undefined,
  _format: string | null | undefined,
  requestedRole?: string | null | undefined,
): DebateSession {
  const base: DebateSession = { ...mockDebateSession };
  const id = topicId?.trim();
  const selectedRole = parseRequestedRole(requestedRole);

  let rawTitle = base.topicTitle;
  if (id === "custom") {
    rawTitle = customTitle?.trim() || "Custom topic";
  } else if (id) {
    const topic = mockTopics.find((t) => t.id === id);
    if (topic) {
      rawTitle = topic.description;
    }
  }

  return buildWsdaSession(rawTitle, selectedRole);
}

/** Live arena room from DB — topic + opponent resolved server-side. */
export function buildArenaDebateSession(input: {
  roomId: string;
  topicTitle: string;
  opponentName: string;
  userRole: "pro" | "con";
  debateFormat: "wsda" | "free_form";
  selfAvatarUrl?: string;
  opponentAvatarUrl?: string;
}): DebateSession {
  const first = WSDA_PHASES[0];
  const isWsda = input.debateFormat === "wsda";
  const soloSeconds = 60;
  return {
    ...mockDebateSession,
    id: `debate_arena_${input.roomId}`,
    arenaRoomId: input.roomId,
    topicTitle: input.topicTitle,
    locationLabel: isWsda ? "WSDA Arena — Live match" : "Free Form Arena — Live match",
    phaseLabel: isWsda ? wsdaPhaseBanner(0) : "Open Debate",
    timerMmSs: isWsda
      ? first
        ? formatMmSs(first.durationSec)
        : "02:00"
      : formatMmSs(soloSeconds),
    phaseDurationSeconds: isWsda ? (first?.durationSec ?? 120) : undefined,
    soloDurationSeconds: isWsda ? undefined : soloSeconds,
    debateFormat: input.debateFormat,
    opponentName: input.opponentName,
    userRole: input.userRole,
    selfAvatarUrl: input.selfAvatarUrl,
    opponentAvatarUrl: input.opponentAvatarUrl,
  };
}

export function getDebateHistory(): DebateResult[] {
  return mockDebateHistory;
}

export function getDebateResultById(id: string): DebateResult | undefined {
  return mockDebateHistory.find((d) => d.id === id);
}

/** @deprecated Use getDebateHistory / getDebateResultById */
export function getMockDebateResult(): DebateResult {
  return mockDebateHistory[0];
}
