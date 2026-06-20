"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { writeActiveDebateTranscript } from "@/lib/data/history-storage";
import { pickOpponentSimLine } from "@/lib/debate/con-sim-lines";
import {
  normalizeSingleCrossExQuestion,
  proConstructiveOpening,
  WSDA_PHASES,
  wsdaRoundChatCopy,
  wsdaRoundTransitionMessage,
} from "@/lib/debate/wsda-schedule";
import {
  getAgeBandPreference,
  pickMinecraftAvatarBySeed,
  useUserProfile,
} from "@/lib/data/profile-storage";
import type { DebateTranscriptEntry } from "@/lib/data/types";
import {
  useArenaRoomMessages,
  type ArenaRoomMessageRow,
} from "@/lib/debate/use-arena-room-messages";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";

type WsdaChatRow =
  | { kind: "system"; key: string; at: string; text: string }
  | { kind: "arena"; msg: ArenaRoomMessageRow }
  | { kind: "local"; timelineKey: string; id: number; text: string; postedAt: string }
  | { kind: "opening"; entry: DebateTranscriptEntry }
  | {
      kind: "opponent";
      timelineKey: string;
      id: number;
      text: string;
      postedAt: string;
      usedFallback: boolean;
    };

function isOpponentLedCrossExPhase(
  phase: number,
  role: "pro" | "con" | undefined,
): boolean {
  return (
    (phase === 1 && role === "pro") || (phase === 3 && role === "con")
  );
}

function isUserLedCrossExPhase(
  phase: number,
  role: "pro" | "con" | undefined,
): boolean {
  return (
    (phase === 1 && role === "con") || (phase === 3 && role === "pro")
  );
}

type DebateChatPanelProps = {
  sessionId: string;
  opponentName: string;
  phaseLabel: string;
  debateFormat?: "wsda" | "free_form";
  topicTitle?: string;
  userRole?: "pro" | "con";
  /** WSDA: current segment index (0-based). */
  phaseIndex?: number;
  /** WSDA: whether the user may post in this segment. */
  userCanPost?: boolean;
  /** Shown when input is disabled (turn / prep). */
  inputDisabledHint?: string;
  /** WSDA: seconds left for current session. */
  secondsLeft?: number;
  /** WSDA: debate finished. */
  roundComplete?: boolean;
  /** Solo WSDA: simulate AI opponent when they speak or lead cross-ex. */
  simulateSoloOpponent?: boolean;
  /** Live arena: sync typed messages to Supabase for the other player. */
  arenaRoomId?: string;
  /** Live arena: from Supabase `profiles` (overrides local profile + seeded opponent head). */
  selfAvatarUrl?: string;
  opponentAvatarUrl?: string;
};

export function DebateChatPanel({
  sessionId,
  opponentName,
  phaseLabel,
  debateFormat,
  topicTitle,
  userRole,
  phaseIndex = 0,
  userCanPost = true,
  inputDisabledHint,
  secondsLeft = 0,
  roundComplete = false,
  simulateSoloOpponent = false,
  arenaRoomId,
  selfAvatarUrl: selfAvatarUrlOverride,
  opponentAvatarUrl: opponentAvatarUrlOverride,
}: DebateChatPanelProps) {
  const user = useUserProfile();
  const {
    messages: arenaMessages,
    currentUserId: arenaUserId,
    send: arenaSend,
  } = useArenaRoomMessages(
    arenaRoomId && isSupabaseConfigured() ? arenaRoomId : undefined,
  );
  const arenaTranscriptRef = useRef<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [soloTimeExpired, setSoloTimeExpired] = useState(false);
  const [userPosts, setUserPosts] = useState<
    { id: number; text: string; postedAt: string }[]
  >([]);
  /** System lines must live in React state so the chat re-renders (ref-only transcript did not). */
  const [wsdaSystemFeed, setWsdaSystemFeed] = useState<DebateTranscriptEntry[]>([]);
  const [wsdaOpeningEntry, setWsdaOpeningEntry] = useState<DebateTranscriptEntry | null>(
    null,
  );
  const [simOpponentPosts, setSimOpponentPosts] = useState<
    {
      id: number;
      text: string;
      phaseIndex: number;
      postedAt: string;
      usedFallback: boolean;
    }[]
  >([]);
  const transcriptRef = useRef<DebateTranscriptEntry[]>([]);
  const soloTimeExpiredRef = useRef(false);
  /** Shared counter so user and opponent chat rows never share React list keys. */
  const chatMessageIdRef = useRef(0);
  const soloPhaseSpeechRef = useRef<Set<number>>(new Set());
  const crossExInitializedRef = useRef<Set<number>>(new Set());
  const soloOpponentAbortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedTranscriptRef = useRef(false);
  const prevWsdaPhaseRef = useRef<number | null>(null);
  const transitionEmittedRef = useRef<Set<string>>(new Set());
  const debateEndAnnouncedRef = useRef(false);
  const phaseIndexRef = useRef(phaseIndex);
  phaseIndexRef.current = phaseIndex;

  const isWsda =
    debateFormat === "wsda" &&
    Boolean(topicTitle?.trim()) &&
    (userRole === "pro" || userRole === "con");

  const proSpeech = topicTitle?.trim()
    ? proConstructiveOpening(topicTitle.trim())
    : "";
  const youDisplayName = user.displayName || "Master Builder";
  const yourAvatarUrl = selfAvatarUrlOverride ?? user.avatarUrl;
  const opponentAvatarUrl = useMemo(
    () =>
      opponentAvatarUrlOverride ??
      pickMinecraftAvatarBySeed(opponentName || "opponent"),
    [opponentAvatarUrlOverride, opponentName],
  );

  const setTranscriptEntries = useCallback(
    (entries: DebateTranscriptEntry[]) => {
      transcriptRef.current = entries;
      writeActiveDebateTranscript(sessionId, entries);
    },
    [sessionId],
  );

  const appendTranscriptEntry = useCallback(
    (entry: DebateTranscriptEntry) => {
      const next = [...transcriptRef.current, entry];
      setTranscriptEntries(next);
      if (debateFormat === "wsda" && entry.speaker === "System") {
        setWsdaSystemFeed((prev) => [...prev, entry]);
      }
    },
    [debateFormat, setTranscriptEntries],
  );

  const requestSoloOpponentReply = useCallback(
    async (
      transcript: DebateTranscriptEntry[],
      signal?: AbortSignal,
      phaseOverride?: number,
      crossExTurn?: "ask" | "answer",
    ): Promise<
      | { aborted: true; reply: null; usedFallback: false; reason: null }
      | { aborted: false; reply: string; usedFallback: boolean; reason: string | null }
    > => {
      const targetPhase = phaseOverride ?? phaseIndex;
      const phaseMeta = WSDA_PHASES[targetPhase];
      const fallbacks = [
        "Your claim assumes intent matters more than outcomes, but policy is judged by impact first.",
        "You frame risk well, yet you still need a practical mechanism that scales beyond ideal cases.",
        "I disagree: your standard values caution, but it underestimates the cost of delaying progress.",
        "That argument is principled, but it dodges the tradeoff between fairness, speed, and access.",
      ];
      const lastUserLine =
        [...transcript].reverse().find((entry) => entry.speaker.includes("(You)"))?.text?.slice(
          0,
          120,
        ) ?? "";
      const fallback = `${fallbacks[Math.floor(Math.random() * fallbacks.length)]}${
        lastUserLine ? ` You said: "${lastUserLine}".` : ""
      }`;
      const wsdaFallback =
        isWsda && phaseMeta
          ? pickOpponentSimLine(
              targetPhase,
              userRole === "pro" ? "con" : "pro",
              crossExTurn,
            )
          : fallback;
      try {
        const res = await fetch("/api/ai/opponent-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            topicTitle: topicTitle?.trim() || phaseLabel,
            opponentName,
            userRole,
            ageBand: getAgeBandPreference(),
            transcript,
            ...(isWsda && phaseMeta
              ? {
                  debateFormat: "wsda" as const,
                  phaseIndex: targetPhase,
                  phaseLabel: phaseMeta.label,
                  phasePurpose: phaseMeta.purpose,
                  ...(crossExTurn ? { crossExTurn } : {}),
                }
              : {}),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || typeof data.reply !== "string" || !data.reply.trim()) {
          console.warn("opponent-reply failed:", data.error ?? "unknown error");
          return {
            aborted: false as const,
            reply:
              crossExTurn === "ask"
                ? normalizeSingleCrossExQuestion(wsdaFallback)
                : wsdaFallback,
            usedFallback: true,
            reason: data.error ?? "Model response invalid.",
          };
        }
        return {
          aborted: false as const,
          reply:
            crossExTurn === "ask"
              ? normalizeSingleCrossExQuestion(data.reply.trim())
              : data.reply.trim(),
          usedFallback: false,
          reason: null,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            aborted: true as const,
            reply: null,
            usedFallback: false,
            reason: null,
          };
        }
        console.warn("opponent-reply request threw:", error);
        return {
          aborted: false as const,
          reply:
            crossExTurn === "ask"
              ? normalizeSingleCrossExQuestion(wsdaFallback)
              : wsdaFallback,
          usedFallback: true,
          reason: error instanceof Error ? error.message : "Network failure.",
        };
      }
    },
    [debateFormat, isWsda, opponentName, phaseIndex, phaseLabel, topicTitle, userRole],
  );

  useEffect(() => {
    if (initializedTranscriptRef.current) return;
    initializedTranscriptRef.current = true;
    const now = new Date().toISOString();

    if (isWsda) {
      const t0 = Date.now();
      const at = (i: number) => new Date(t0 + i).toISOString();
      const initial: DebateTranscriptEntry[] = [
        {
          speaker: "System",
          text: `Debate opened: ${topicTitle?.trim() || "WSDA round"}`,
          at: at(0),
        },
      ];
      const copy = wsdaRoundChatCopy(phaseIndex);
      if (copy) {
        initial.push({
          speaker: "System",
          text: `Session ${copy.roundNumber}/${copy.totalRounds}: ${copy.headline}. ${copy.purpose} ${copy.instruction}`,
          at: at(1),
        });
      }
      if (phaseIndex === 0 && proSpeech && !arenaRoomId && userRole === "pro") {
        const opening: DebateTranscriptEntry = {
          speaker: "You (Pro)",
          text: proSpeech,
          at: at(2),
        };
        initial.push(opening);
        setWsdaOpeningEntry(opening);
      }
      setTranscriptEntries(initial);
      setWsdaSystemFeed(initial.filter((e) => e.speaker === "System"));
      return;
    }

    const initialTranscript: DebateTranscriptEntry[] = [
      {
        speaker: "System",
        text: `Debate opened: ${topicTitle?.trim() || phaseLabel}`,
        at: now,
      },
    ];
    setTranscriptEntries(initialTranscript);
    setSoloTimeExpired(false);
    soloTimeExpiredRef.current = false;
  }, [
    appendTranscriptEntry,
    isWsda,
    arenaRoomId,
    opponentName,
    phaseIndex,
    phaseLabel,
    proSpeech,
    setTranscriptEntries,
    topicTitle,
    youDisplayName,
    userRole,
  ]);

  useEffect(() => {
    if (isWsda) return;
    const onTimeUp = (event: Event) => {
      const custom = event as CustomEvent<{ sessionId?: string }>;
      if (custom.detail?.sessionId !== sessionId) return;
      soloTimeExpiredRef.current = true;
      setSoloTimeExpired(true);
    };
    window.addEventListener("solo-debate-time-up", onTimeUp as EventListener);
    return () => {
      window.removeEventListener("solo-debate-time-up", onTimeUp as EventListener);
    };
  }, [isWsda, sessionId]);

  useEffect(() => {
    if (!isWsda) return;
    const prev = prevWsdaPhaseRef.current;
    prevWsdaPhaseRef.current = phaseIndex;
    if (prev === null) {
      return;
    }
    if (phaseIndex <= prev) {
      return;
    }
    const key = `${prev}->${phaseIndex}`;
    if (transitionEmittedRef.current.has(key)) {
      return;
    }
    const text = wsdaRoundTransitionMessage(prev);
    if (!text) {
      return;
    }
    transitionEmittedRef.current.add(key);
    appendTranscriptEntry({
      speaker: "System",
      text,
      at: new Date().toISOString(),
    });
  }, [appendTranscriptEntry, isWsda, phaseIndex]);

  useEffect(() => {
    if (!roundComplete || !isWsda || debateEndAnnouncedRef.current) {
      return;
    }
    debateEndAnnouncedRef.current = true;
    appendTranscriptEntry({
      speaker: "System",
      text: "Debate complete. All WSDA sessions finished.",
      at: new Date().toISOString(),
    });
  }, [appendTranscriptEntry, isWsda, roundComplete]);

  const wsdaArenaTimeline = useMemo((): WsdaChatRow[] => {
    if (!arenaRoomId) return [];
    const rows: WsdaChatRow[] = [];
    let sk = 0;
    for (const e of wsdaSystemFeed) {
      if (e.speaker !== "System") continue;
      rows.push({
        kind: "system",
        key: `sys-${sk++}-${e.at}-${e.text.slice(0, 32)}`,
        at: e.at,
        text: e.text,
      });
    }
    for (const m of arenaMessages) {
      rows.push({ kind: "arena", msg: m });
    }
    const rowTime = (r: WsdaChatRow) => {
      if (r.kind === "system") return +new Date(r.at);
      if (r.kind === "arena") return +new Date(r.msg.created_at);
      return 0;
    };
    rows.sort((a, b) => {
      const ta = rowTime(a);
      const tb = rowTime(b);
      if (ta !== tb) return ta - tb;
      return a.kind === "system" ? -1 : 1;
    });
    return rows;
  }, [arenaRoomId, wsdaSystemFeed, arenaMessages]);

  const wsdaLocalTimeline = useMemo((): WsdaChatRow[] => {
    if (!isWsda || arenaRoomId) return [];
    const rows: WsdaChatRow[] = [];
    let sk = 0;
    for (const e of wsdaSystemFeed) {
      if (e.speaker !== "System") continue;
      rows.push({
        kind: "system",
        key: `sys-${sk++}-${e.at}-${e.text.slice(0, 32)}`,
        at: e.at,
        text: e.text,
      });
    }
    if (wsdaOpeningEntry) {
      rows.push({ kind: "opening", entry: wsdaOpeningEntry });
    }
    for (const p of userPosts) {
      rows.push({
        kind: "local",
        timelineKey: `user-${p.id}-${p.postedAt}`,
        id: p.id,
        text: p.text,
        postedAt: p.postedAt,
      });
    }
    for (const p of simOpponentPosts) {
      rows.push({
        kind: "opponent",
        timelineKey: `opp-${p.id}-${p.postedAt}`,
        id: p.id,
        text: p.text,
        postedAt: p.postedAt,
        usedFallback: p.usedFallback,
      });
    }
    rows.sort((a, b) => {
      const time = (r: WsdaChatRow) => {
        switch (r.kind) {
          case "system":
            return +new Date(r.at);
          case "opening":
            return +new Date(r.entry.at);
          case "local":
            return +new Date(r.postedAt);
          case "opponent":
            return +new Date(r.postedAt);
          default:
            return 0;
        }
      };
      const ta = time(a);
      const tb = time(b);
      if (ta !== tb) return ta - tb;
      if (a.kind === "local" && b.kind === "local") return a.id - b.id;
      if (a.kind === "opponent" && b.kind === "opponent") return a.id - b.id;
      if (a.kind === b.kind) return 0;
      if (a.kind === "system" || a.kind === "opening") return -1;
      return 1;
    });
    return rows;
  }, [isWsda, arenaRoomId, wsdaSystemFeed, wsdaOpeningEntry, userPosts, simOpponentPosts]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [
    userPosts.length,
    simOpponentPosts.length,
    arenaMessages.length,
    phaseIndex,
    isWsda,
    roundComplete,
    wsdaArenaTimeline.length,
    wsdaLocalTimeline.length,
  ]);

  const youRoleTag = userRole === "pro" ? "Pro" : "Con";
  const opponentRoleTag = userRole === "pro" ? "Con" : "Pro";
  const opponentSide = userRole === "pro" ? "con" : "pro";

  const appendSimOpponentPost = useCallback(
    (
      text: string,
      phase: number,
      usedFallback: boolean,
      crossExTurn?: "ask" | "answer",
    ) => {
      const normalized =
        crossExTurn === "ask" ? normalizeSingleCrossExQuestion(text) : text;
      const postedAt = new Date().toISOString();
      chatMessageIdRef.current += 1;
      const id = chatMessageIdRef.current;
      setSimOpponentPosts((prev) => [
        ...prev,
        { id, text: normalized, phaseIndex: phase, postedAt, usedFallback },
      ]);
      appendTranscriptEntry({
        speaker: `${opponentName} (${opponentRoleTag})`,
        text: normalized,
        at: postedAt,
      });
    },
    [appendTranscriptEntry, opponentName, opponentRoleTag],
  );

  const requestAndAppendSoloOpponentReply = useCallback(
    async (
      phase: number,
      signal?: AbortSignal,
      crossExTurn?: "ask" | "answer",
    ): Promise<"ok" | "aborted" | "failed"> => {
      const result = await requestSoloOpponentReply(
        transcriptRef.current,
        signal,
        phase,
        crossExTurn,
      );
      if (result.aborted) {
        return "aborted";
      }
      if (phaseIndexRef.current !== phase) {
        return "aborted";
      }
      if (result.reply === null) {
        return "failed";
      }
      appendSimOpponentPost(
        result.reply,
        phase,
        result.usedFallback,
        crossExTurn,
      );
      return "ok";
    },
    [appendSimOpponentPost, requestSoloOpponentReply],
  );

  useEffect(() => {
    soloOpponentAbortRef.current?.abort();
    soloOpponentAbortRef.current = null;
  }, [phaseIndex]);

  useEffect(() => {
    if (!isWsda || arenaRoomId || !simulateSoloOpponent || roundComplete) {
      return;
    }

    const phase = WSDA_PHASES[phaseIndex];
    if (!phase) return;

    const opponentLeadsCrossEx = isOpponentLedCrossExPhase(
      phaseIndex,
      userRole,
    );

    const opponentSpeaksAlone = phase.activeSpeaker === opponentSide;

    let cancelled = false;

    const runWithFallback = async (
      targetPhase: number,
      crossExTurn?: "ask" | "answer",
    ) => {
      const controller = new AbortController();
      soloOpponentAbortRef.current = controller;
      const status = await requestAndAppendSoloOpponentReply(
        targetPhase,
        controller.signal,
        crossExTurn,
      );
      if (soloOpponentAbortRef.current === controller) {
        soloOpponentAbortRef.current = null;
      }
      if (cancelled || status === "ok" || status === "aborted") {
        return;
      }
      if (phaseIndexRef.current !== targetPhase) {
        return;
      }
      appendSimOpponentPost(
        pickOpponentSimLine(targetPhase, opponentSide, crossExTurn),
        targetPhase,
        true,
        crossExTurn,
      );
    };

    if (opponentSpeaksAlone) {
      if (soloPhaseSpeechRef.current.has(phaseIndex)) {
        return;
      }
      soloPhaseSpeechRef.current.add(phaseIndex);
      const timeoutId = window.setTimeout(() => {
        void runWithFallback(phaseIndex);
      }, 1200);
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
        soloOpponentAbortRef.current?.abort();
      };
    }

    if (opponentLeadsCrossEx) {
      if (crossExInitializedRef.current.has(phaseIndex)) {
        return;
      }
      crossExInitializedRef.current.add(phaseIndex);
      const timeoutId = window.setTimeout(() => {
        void runWithFallback(phaseIndex, "ask");
      }, 2000);
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
        soloOpponentAbortRef.current?.abort();
      };
    }
  }, [
    appendSimOpponentPost,
    arenaRoomId,
    isWsda,
    opponentSide,
    phaseIndex,
    requestAndAppendSoloOpponentReply,
    roundComplete,
    simulateSoloOpponent,
    userRole,
  ]);

  const inputLocked =
    roundComplete ||
    !userCanPost ||
    (!isWsda && soloTimeExpired);

  useEffect(() => {
    arenaTranscriptRef.current.clear();
  }, [arenaRoomId]);

  useEffect(() => {
    if (!arenaRoomId) return;
    for (const m of arenaMessages) {
      if (arenaTranscriptRef.current.has(m.id)) continue;
      arenaTranscriptRef.current.add(m.id);
      const isSelf = arenaUserId != null && m.user_id === arenaUserId;
      appendTranscriptEntry({
        speaker: isSelf
          ? isWsda
            ? `You (${youRoleTag})`
            : `${youDisplayName} (You)`
          : isWsda
            ? `${opponentName} (${opponentRoleTag})`
            : opponentName,
        text: m.body,
        at: m.created_at,
      });
    }
  }, [
    arenaMessages,
    arenaRoomId,
    arenaUserId,
    isWsda,
    opponentName,
    opponentRoleTag,
    youDisplayName,
    youRoleTag,
    appendTranscriptEntry,
  ]);

  function postMessage() {
    if (inputLocked) return;
    const text = draft.trim();
    if (!text) return;

    if (arenaRoomId && isSupabaseConfigured()) {
      void (async () => {
        const result = await arenaSend(text);
        if (result.error === null) {
          setDraft("");
        }
      })();
      return;
    }

    const postedAt = new Date().toISOString();
    if (isWsda) {
      chatMessageIdRef.current += 1;
      setUserPosts((prev) => [
        ...prev,
        { id: chatMessageIdRef.current, text, postedAt },
      ]);
    }
    appendTranscriptEntry({
      speaker: isWsda ? `You (${youRoleTag})` : `${youDisplayName} (You)`,
      text,
      at: postedAt,
    });
    setDraft("");
    if (isWsda && !arenaRoomId) {
      const userLeadsCrossEx = isUserLedCrossExPhase(phaseIndex, userRole);
      const opponentLeadsCrossEx = isOpponentLedCrossExPhase(
        phaseIndex,
        userRole,
      );
      const crossExTurn = userLeadsCrossEx
        ? "answer"
        : opponentLeadsCrossEx
          ? "ask"
          : undefined;
      if (!crossExTurn) {
        return;
      }
      if (crossExTurn === "ask" && secondsLeft <= 5) {
        return;
      }
      const phaseAtPost = phaseIndex;
      const controller = new AbortController();
      soloOpponentAbortRef.current = controller;
      void (async () => {
        const status = await requestAndAppendSoloOpponentReply(
          phaseAtPost,
          controller.signal,
          crossExTurn,
        );
        if (soloOpponentAbortRef.current === controller) {
          soloOpponentAbortRef.current = null;
        }
        if (status === "failed" && phaseIndexRef.current === phaseAtPost) {
          appendSimOpponentPost(
            pickOpponentSimLine(phaseAtPost, opponentSide, crossExTurn),
            phaseAtPost,
            true,
            crossExTurn,
          );
        }
      })();
      return;
    }
  }

  const footerHint =
    roundComplete
      ? "Round complete. Use End to leave or review results."
      : !isWsda && soloTimeExpired
        ? "Time is up. Arena free-form debate has ended."
      : inputLocked
        ? inputDisabledHint ??
          "You cannot type during this segment."
        : null;
  const currentSessionCopy =
    isWsda && !roundComplete ? wsdaRoundChatCopy(phaseIndex) : null;

  return (
    <>
      {currentSessionCopy ? (
        <div className="w-full border-y-2 border-orange-700 bg-orange-950/85 px-4 py-3 shadow-[0_4px_0px_0px_rgba(0,0,0,0.35)] md:px-6">
          <p className="pixel-text-xs font-black uppercase text-orange-400">
            Current session {currentSessionCopy.roundNumber} of{" "}
            {currentSessionCopy.totalRounds}
          </p>
          <p className="pixel-text-xs mt-2 font-bold uppercase tracking-wide text-white whitespace-nowrap">
            {currentSessionCopy.headline}
          </p>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="pixel-bg-grid relative max-h-[min(700px,55vh)] flex-1 space-y-10 overflow-y-auto p-4 md:p-6"
      >
        {isWsda && roundComplete ? (
          <div className="flex justify-center">
            <div className="max-w-[95%] border-2 border-stone-600 bg-stone-900/90 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
              <p className="pixel-text-xs font-black uppercase text-stone-400">
                Debate complete
              </p>
              <p className="pixel-text-xs mt-2 font-medium leading-relaxed text-stone-300 normal-case">
                All WSDA segments have finished. Thank both sides.
              </p>
            </div>
          </div>
        ) : null}

        {arenaRoomId
          ? wsdaArenaTimeline.map((row) => {
              if (row.kind === "system") {
                return (
                  <div key={row.key} className="flex justify-center px-1">
                    <div className="max-w-[min(100%,52rem)] border-2 border-orange-700/60 bg-orange-950/50 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.45)] md:px-5">
                      <p className="pixel-text-xs font-black uppercase tracking-wide text-orange-400">
                        System
                      </p>
                      <p className="pixel-text-xs mt-2 font-medium leading-relaxed whitespace-pre-wrap text-stone-200 normal-case">
                        {row.text}
                      </p>
                    </div>
                  </div>
                );
              }
              if (row.kind !== "arena") {
                return null;
              }
              const m = row.msg;
              const isSelf =
                arenaUserId != null && m.user_id === arenaUserId;
              return (
                <div
                  key={m.id}
                  className={
                    isSelf
                      ? "flex flex-row-reverse items-start gap-4"
                      : "flex items-start gap-4"
                  }
                >
                  <div
                    className={`h-12 w-12 flex-shrink-0 border-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] md:h-14 md:w-14 ${
                      isSelf
                        ? "border-red-500 bg-primary"
                        : "border-red-600 bg-red-900"
                    }`}
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={isSelf ? yourAvatarUrl : opponentAvatarUrl}
                    />
                  </div>
                  <div
                    className={`max-w-[85%] border-2 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] backdrop-blur-md md:p-5 ${
                      isSelf
                        ? "border-on-primary-fixed-variant bg-primary-fixed/90"
                        : "border-red-900/50 bg-black/80"
                    }`}
                  >
                    <span
                      className={`pixel-text-xs mb-3 block font-bold uppercase ${
                        isSelf
                          ? "text-right text-on-primary-fixed-variant"
                          : "text-orange-400"
                      }`}
                    >
                      {isSelf
                        ? isWsda
                          ? `You (${youRoleTag})`
                          : `${youDisplayName} (You)`
                        : isWsda
                          ? `${opponentName} (${opponentRoleTag})`
                          : opponentName}
                    </span>
                    <p
                      className={`pixel-text-xs leading-loose whitespace-pre-wrap ${
                        isSelf ? "text-on-primary-container" : "text-stone-200"
                      }`}
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              );
            })
          : null}

        {!arenaRoomId && isWsda
          ? wsdaLocalTimeline.map((row) => {
              if (row.kind === "system") {
                return (
                  <div key={row.key} className="flex justify-center px-1">
                    <div className="max-w-[min(100%,52rem)] border-2 border-orange-700/60 bg-orange-950/50 px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.45)] md:px-5">
                      <p className="pixel-text-xs font-black uppercase tracking-wide text-orange-400">
                        System
                      </p>
                      <p className="pixel-text-xs mt-2 font-medium leading-relaxed whitespace-pre-wrap text-stone-200 normal-case">
                        {row.text}
                      </p>
                    </div>
                  </div>
                );
              }
              if (row.kind === "opening") {
                const e = row.entry;
                const isYou = e.speaker.startsWith("You ");
                return isYou ? (
                  <div
                    key={`opening-${e.at}`}
                    className="flex flex-row-reverse items-start gap-4"
                  >
                    <div className="h-12 w-12 flex-shrink-0 border-4 border-red-500 bg-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] md:h-14 md:w-14">
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={yourAvatarUrl}
                      />
                    </div>
                    <div className="max-w-[85%] border-2 border-on-primary-fixed-variant bg-primary-fixed/90 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] backdrop-blur-md md:p-5">
                      <span className="pixel-text-xs mb-3 block text-right font-bold uppercase text-on-primary-fixed-variant">
                        {e.speaker} — Pro Constructive
                      </span>
                      <p className="pixel-text-xs leading-loose text-on-primary-container">
                        {e.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`opening-${e.at}`}
                    className="flex items-start gap-4"
                  >
                    <div className="h-12 w-12 flex-shrink-0 border-4 border-red-600 bg-red-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] md:h-14 md:w-14">
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={opponentAvatarUrl}
                      />
                    </div>
                    <div className="max-w-[85%] border-2 border-red-900/50 bg-black/80 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] backdrop-blur-md md:p-5">
                      <span className="pixel-text-xs mb-3 block font-bold uppercase text-orange-400">
                        {e.speaker} — Pro Constructive
                      </span>
                      <p className="pixel-text-xs leading-loose text-stone-200">{e.text}</p>
                    </div>
                  </div>
                );
              }
              if (row.kind === "local") {
                return (
                  <div
                    key={row.timelineKey}
                    className="flex flex-row-reverse items-start gap-4"
                  >
                    <div className="h-12 w-12 flex-shrink-0 border-4 border-red-500 bg-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] md:h-14 md:w-14">
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={yourAvatarUrl}
                      />
                    </div>
                    <div className="max-w-[85%] border-2 border-on-primary-fixed-variant bg-primary-fixed/90 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] backdrop-blur-md md:p-5">
                      <span className="pixel-text-xs mb-3 block text-right font-bold uppercase text-on-primary-fixed-variant">
                        {`You (${youRoleTag})`}
                      </span>
                      <p className="pixel-text-xs leading-loose whitespace-pre-wrap text-on-primary-container">
                        {row.text}
                      </p>
                    </div>
                  </div>
                );
              }
              if (row.kind === "opponent") {
                return (
                  <div key={row.timelineKey} className="flex items-start gap-4">
                    <div className="h-12 w-12 flex-shrink-0 border-4 border-tertiary bg-tertiary/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] md:h-14 md:w-14">
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={opponentAvatarUrl}
                      />
                    </div>
                    <div className="max-w-[85%] border-2 border-tertiary/60 bg-[#0a1628]/90 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] backdrop-blur-md md:p-5">
                      <span className="pixel-text-xs mb-3 block font-bold uppercase text-tertiary-fixed">
                        {opponentName} ({opponentRoleTag})
                      </span>
                      <span
                        className={`mb-3 inline-flex border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          row.usedFallback
                            ? "border-orange-700 bg-orange-950/60 text-orange-300"
                            : "border-emerald-700 bg-emerald-950/60 text-emerald-300"
                        }`}
                      >
                        {row.usedFallback ? "Fallback Reply" : "AI Reply"}
                      </span>
                      <p className="pixel-text-xs leading-loose text-stone-200 whitespace-pre-wrap">
                        {row.text}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })
          : null}

        <div className="pixel-text-xs ml-4 flex items-center gap-3 italic text-orange-700 md:ml-16">
          <span className="h-2 w-2 animate-pulse bg-red-900" />
          <span className="h-2 w-2 animate-pulse bg-red-800 [animation-delay:75ms]" />
          <span className="h-2 w-2 animate-pulse bg-red-700 [animation-delay:150ms]" />
          {isWsda
            ? roundComplete
              ? "Debate finished — all WSDA segments complete."
              : arenaRoomId
                ? "Live arena — messages sync between both players."
                : simulateSoloOpponent
                  ? `Opponent (${opponentRoleTag}) is responding — follow the phase rules.`
                  : userCanPost && !roundComplete
                    ? "Your side may speak — stay within the rules for this phase."
                    : inputDisabledHint ?? "Wait for your turn."
            : arenaRoomId
              ? "Live arena — messages sync between both players."
              : "Ready for your next argument."}
        </div>
      </div>

      <div className="border-t-8 border-orange-600 bg-red-950 p-4 shadow-[0_-10px_20px_rgba(255,69,0,0.2)] md:p-6">
        {footerHint ? (
          <p className="pixel-text-xs mb-3 border-2 border-stone-700 bg-stone-900/80 px-3 py-2 text-center font-bold uppercase tracking-wide text-stone-400">
            {footerHint}
          </p>
        ) : null}
        <form
          className={`flex items-end gap-3 border-4 border-black bg-stone-900 p-3 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.5)] ${
            inputLocked ? "opacity-75" : ""
          }`}
          onSubmit={(e) => {
            e.preventDefault();
            postMessage();
          }}
        >
          <span className="ml-2 font-bold text-orange-900">&gt;</span>
          <textarea
            className="pixel-text-xs max-h-36 min-h-[2.5rem] flex-1 resize-none border-none bg-transparent leading-relaxed text-orange-500 placeholder:text-red-900 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={
              inputLocked
                ? footerHint ?? "Input locked"
                : "Toss argument..."
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                postMessage();
              }
            }}
            aria-label="Your argument"
            autoComplete="off"
            disabled={inputLocked}
            rows={1}
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="submit"
              disabled={inputLocked}
              className="border-b-4 border-orange-950 bg-orange-700 px-4 py-2 text-white pixel-text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] transition-all enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 md:px-8 md:py-3"
            >
              POST
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
