/** WSDA-style round structure (ClassResources/docs/wsda_rules.md). */

/** Who may speak or type in this segment; `none` = prep (silence, no typing). */
export type WsdaActiveSpeaker = "pro" | "con" | "both" | "none";

export type WsdaPhase = {
  /** Short label for UI lists */
  label: string;
  /** What happens in this segment */
  purpose: string;
  /** Segment length in seconds */
  durationSec: number;
  /** Which side may speak/type in this segment. */
  activeSpeaker: WsdaActiveSpeaker;
  /** System behavior shown in the UI and system copy. */
  systemBehavior: string;
};

export const WSDA_PHASES: WsdaPhase[] = [
  {
    label: "Pro Constructive",
    purpose: "Present the Pro's case",
    durationSec: 120,
    activeSpeaker: "pro",
    systemBehavior: "Pro can type and send text; Con cannot.",
  },
  {
    label: "Con Cross-Examination of the Pro",
    purpose: "Con asks questions, Pro answers",
    durationSec: 60,
    activeSpeaker: "both",
    systemBehavior: "Both can type and send text.",
  },
  {
    label: "Con Constructive",
    purpose: "Present the Con's case",
    durationSec: 120,
    activeSpeaker: "con",
    systemBehavior: "Con can type and send text; Pro cannot.",
  },
  {
    label: "Pro Cross-Examination of the Con",
    purpose: "Pro asks questions",
    durationSec: 60,
    activeSpeaker: "both",
    systemBehavior: "Both can type and send text.",
  },
  {
    label: "Mandatory Prep Time",
    purpose: "Both sides prepare for rebuttal",
    durationSec: 60,
    activeSpeaker: "none",
    systemBehavior: "Neither side can type or send text.",
  },
  {
    label: "Pro Rebuttal",
    purpose: "Refute the opposing side's arguments",
    durationSec: 120,
    activeSpeaker: "pro",
    systemBehavior: "Pro can type and send text; Con cannot.",
  },
  {
    label: "Con Rebuttal",
    purpose: "Refute the opposing side's arguments",
    durationSec: 120,
    activeSpeaker: "con",
    systemBehavior: "Con can type and send text; Pro cannot.",
  },
  {
    label: "Mandatory Prep Time",
    purpose: "Both sides prepare for final focus",
    durationSec: 60,
    activeSpeaker: "none",
    systemBehavior: "Neither side can type or send text.",
  },
  {
    label: "Pro Conclusion Speech",
    purpose: "Explain reasons that you win the round",
    durationSec: 120,
    activeSpeaker: "pro",
    systemBehavior: "Pro can type and send text; Con cannot.",
  },
  {
    label: "Con Conclusion Speech",
    purpose: "Explain reasons that you win the round",
    durationSec: 120,
    activeSpeaker: "con",
    systemBehavior: "Con can type and send text; Pro cannot.",
  },
];

export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function wsdaPhaseBanner(index: number): string {
  const p = WSDA_PHASES[index];
  if (!p) return "Round complete";
  return `${p.label} — ${p.purpose} (${formatMmSs(p.durationSec)})`;
}

export function wsdaActiveSpeakerLabel(s: WsdaActiveSpeaker): string {
  if (s === "none") return "Prep (no speaking)";
  if (s === "both") return "Both";
  return s === "pro" ? "Pro" : "Con";
}

/** Whether the participant in `userRole` may type in this segment. */
export function userMaySpeak(
  activeSpeaker: WsdaActiveSpeaker,
  userRole: "pro" | "con",
): boolean {
  if (activeSpeaker === "none") return false;
  if (activeSpeaker === "both") return true;
  return activeSpeaker === userRole;
}

/** Copy for in-chat system announcements per segment. */
export function wsdaRoundChatCopy(phaseIndex: number): {
  roundNumber: number;
  totalRounds: number;
  headline: string;
  purpose: string;
  instruction: string;
} | null {
  const p = WSDA_PHASES[phaseIndex];
  if (!p) return null;
  const totalRounds = WSDA_PHASES.length;
  const roundNumber = phaseIndex + 1;
  const instruction =
    p.activeSpeaker === "none"
      ? "Neither side may type — silent preparation."
      : p.activeSpeaker === "both"
        ? "Both sides may type and send text in this cross-examination."
      : p.activeSpeaker === "pro"
        ? "Only Pro may type and send arguments. Con must wait."
        : "Only Con may type and send arguments. Pro must wait.";
  return {
    roundNumber,
    totalRounds,
    headline: p.label,
    purpose: p.purpose,
    instruction: `${instruction} ${p.systemBehavior}`,
  };
}

/** Shown in chat when a segment ends — names the segment that finished and the next segment. */
export function wsdaRoundTransitionMessage(completedPhaseIndex: number): string | null {
  const ended = WSDA_PHASES[completedPhaseIndex];
  const nextIdx = completedPhaseIndex + 1;
  const next = WSDA_PHASES[nextIdx];
  if (!ended || !next) return null;
  const endedCopy = wsdaRoundChatCopy(completedPhaseIndex);
  const nextCopy = wsdaRoundChatCopy(nextIdx);
  if (!endedCopy || !nextCopy) return null;
  return (
    `Session ${endedCopy.roundNumber}/${endedCopy.totalRounds} (${endedCopy.headline}) has ended. ` +
    `Next — Session ${nextCopy.roundNumber}/${nextCopy.totalRounds}: ${nextCopy.headline}. ` +
    `${nextCopy.purpose} ${nextCopy.instruction}`
  );
}

/** Keep a single cross-ex question when the model returns multiple. */
export function normalizeSingleCrossExQuestion(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Can you clarify your main warrant?";
  const chunks = trimmed.split(/(?<=[?.!])\s+/);
  const withQuestion = chunks.find((part) => part.includes("?"));
  const chosen = (withQuestion ?? chunks[0] ?? trimmed).trim();
  return chosen.endsWith("?") ? chosen : `${chosen.replace(/[.!]+$/, "")}?`;
}
/** Pro constructive: definitions, framework, impacts — no ad hominem (WSDA). */
export function proConstructiveOpening(topicTitle: string): string {
  return (
    `Resolved: ${topicTitle}. I affirm with clear definitions, a principled framework, and concrete impacts. ` +
    `I will stay on the resolution, cite reasons and examples, and avoid personal attacks—this is our Pro constructive.`
  );
}
