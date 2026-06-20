"use client";

import { useMemo } from "react";
import { DebateChatPanel } from "@/components/DebateChatPanel";
import { useWsdaDebate } from "@/components/wsda/WsdaDebateProvider";

export function WsdaDebateRoom() {
  const {
    session,
    phaseIndex,
    phaseLabel,
    inputHint,
    userCanPost,
    isComplete,
    activeSpeaker,
    secondsLeft,
  } = useWsdaDebate();

  const opponentRole = session.userRole === "pro" ? "con" : "pro";
  const opponentLeadsCrossEx =
    activeSpeaker === "both" &&
    ((phaseIndex === 1 && opponentRole === "con") ||
      (phaseIndex === 3 && opponentRole === "pro"));
  const opponentSpeaksAlone = activeSpeaker === opponentRole;

  const simulateSoloOpponent = useMemo(
    () =>
      !session.arenaRoomId &&
      !isComplete &&
      (opponentSpeaksAlone || opponentLeadsCrossEx),
    [
      session.arenaRoomId,
      isComplete,
      opponentSpeaksAlone,
      opponentLeadsCrossEx,
    ],
  );

  return (
    <DebateChatPanel
      sessionId={session.id}
      opponentName={session.opponentName}
      phaseLabel={phaseLabel}
      debateFormat="wsda"
      topicTitle={session.topicTitle}
      userRole={session.userRole}
      phaseIndex={phaseIndex}
      userCanPost={userCanPost && !isComplete}
      inputDisabledHint={inputHint}
      secondsLeft={secondsLeft}
      roundComplete={isComplete}
      simulateSoloOpponent={simulateSoloOpponent}
      arenaRoomId={session.arenaRoomId}
      selfAvatarUrl={session.selfAvatarUrl}
      opponentAvatarUrl={session.opponentAvatarUrl}
    />
  );
}
