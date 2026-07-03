export type AgeBand = "under10" | "10-14" | "15-18" | "18+";

export type DebatePath = "solo" | "arena";

export interface UserProfile {
  id: string;
  displayName: string;
  level: number;
  rankLabel: string;
  avatarUrl: string;
  /** Lifetime experience orbs (server `profiles.total_experience`; guests mirror in localStorage). */
  totalExperience: number;
}

export interface TopicCategory {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon:
    | "bolt"
    | "pets"
    | "rocket_launch"
    | "memory"
    | "eco"
    | "school"
    | "groups";
  accent: "primary" | "tertiary";
}

export interface DebateSession {
  id: string;
  topicTitle: string;
  locationLabel: string;
  phaseLabel: string;
  timerMmSs: string;
  /** Solo-only total debate time in seconds (3/5/10/15 mins). */
  soloDurationSeconds?: number;
  opponentName: string;
  userRole: "pro" | "con";
  /** Debate format in current session (WSDA structured vs free-form). */
  debateFormat?: "wsda" | "free_form";
  /** Initial segment length for live countdown (WSDA). */
  phaseDurationSeconds?: number;
  /** Supabase `debate_rooms.id` — enables live chat sync between matched players. */
  arenaRoomId?: string;
  /** From `profiles` — live arena only; correct headshots in chat vs local/mock defaults. */
  selfAvatarUrl?: string;
  opponentAvatarUrl?: string;
}

export interface DebateTranscriptEntry {
  speaker: string;
  text: string;
  at: string;
  /** WSDA round segment (0–9) when the message was sent; used for judge segmentation. */
  phaseIndex?: number;
}

/** Allowed per-aspect cell score from the WSDA judge docx rubric. */
export type WsdaAspectScore = 0 | 0.5 | 0.8 | 1;

export type WsdaSegmentScores = {
  logic: WsdaAspectScore;
  coherence: WsdaAspectScore;
  grammar: WsdaAspectScore;
  evidence: WsdaAspectScore;
  reactions: WsdaAspectScore;
  articulation: WsdaAspectScore;
};

export type WsdaUserJudgeAssessment = {
  skillTotal: number;
  persuasivenessTotal: number;
  total: number;
  segments: {
    constructive: WsdaSegmentScores;
    crossExAttack: WsdaSegmentScores;
    crossExDefense: WsdaSegmentScores;
    rebuttal: WsdaSegmentScores;
    finalFocus: WsdaSegmentScores;
  };
};

export type DebateResultScores = {
  clarity: number;
  evidence: number;
  wsda?: WsdaUserJudgeAssessment;
};

export interface DebateResult {
  id: string;
  /** When set, this debate is tied to a live arena room — enables paired purge when both players hide history. */
  arenaRoomId?: string;
  /** Topic line for history list and headers */
  topicTitle: string;
  /** ISO date string (e.g. for sorting / display) */
  debatedAt: string;
  outcome: "victory" | "effort" | "forfeit";
  headline: string;
  subline: string;
  level: number;
  xpCurrent: number;
  xpToNext: number;
  xpEarned: number;
  feedback: string;
  quote: string;
  scores: DebateResultScores;
  suggestedTomes: {
    title: string;
    subtitle: string;
    kind: "enchanted" | "rare";
    label: string;
    accent: "tertiary" | "primary";
    icon: "menu_book" | "psychology";
  }[];
  loot: { label: string; tone: "gold" | "emerald" }[];
  transcript: DebateTranscriptEntry[];
}
