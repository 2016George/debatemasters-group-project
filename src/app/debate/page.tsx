import { DebateChatPanel } from "@/components/DebateChatPanel";
import { DebateRoleMatchupStrip } from "@/components/debate/DebateRoleMatchupStrip";
import { ForfeitEndButton } from "@/components/debate/ForfeitEndButton";
import { ArenaFreeFormTimeoutTimer } from "@/components/debate/ArenaFreeFormTimeoutTimer";
import { FreeFormArenaProvider } from "@/components/debate/FreeFormArenaProvider";
import { WsdaDebateRoom } from "@/components/WsdaDebateRoom";
import { WsdaDebateProvider } from "@/components/wsda/WsdaDebateProvider";
import { WsdaRoleMatchupStrip } from "@/components/wsda/WsdaRoleMatchupStrip";
import { WsdaDebateTimerDisplay } from "@/components/wsda/WsdaDebateTimerDisplay";
import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";
import { MaterialIcon } from "@/components/MaterialIcon";
import {
  WSDA_PHASES,
  formatMmSs,
  wsdaActiveSpeakerLabel,
} from "@/lib/debate/wsda-schedule";
import { loadArenaDebateSession } from "@/lib/data/arena-room-server";
import { getDebateSessionForTopic } from "@/lib/data/repository";
import type { DebateSession } from "@/lib/data/types";
import { normalizeArenaDebateFormat } from "@/lib/matchmaking/arena";
import { redirect } from "next/navigation";

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

type DebatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DebatePage({ searchParams }: DebatePageProps) {
  const sp = await searchParams;
  const roomParam = firstParam(sp.room);
  const topicParam = firstParam(sp.topic);
  const formatParam = firstParam(sp.format);
  const roleParam = firstParam(sp.role);

  let session: DebateSession;
  if (roomParam?.trim()) {
    const rid = roomParam.trim();
    const requestedFormat = normalizeArenaDebateFormat(formatParam, "wsda");
    const arena = await loadArenaDebateSession(rid);
    if (!arena.ok) {
      if (arena.reason === "unauthenticated") {
        redirect(
          `/login?redirect=${encodeURIComponent(
            `/debate?room=${encodeURIComponent(rid)}&format=${encodeURIComponent(requestedFormat)}&topic=custom`,
          )}`,
        );
      }
      redirect("/topics");
    }
    session = arena.session;
  } else {
    session = getDebateSessionForTopic(
      topicParam,
      firstParam(sp.title),
      formatParam,
      roleParam,
    );
  }
  const isArenaFreeForm = Boolean(session.arenaRoomId) && session.debateFormat === "free_form";

  return (
    <div className="debate-room-pixel-bg font-headline-pixel text-on-surface">
      <div className="nether-overlay-room" />
      <NetherSidebarShell
        sidebar={
          <OnboardingSidebar
            leaveGuardSessionMeta={{
              sessionId: session.id,
              topicTitle: session.topicTitle,
              opponentName: session.opponentName,
              userRole: session.userRole,
              debateFormat: session.debateFormat,
              arenaRoomId: session.arenaRoomId,
            }}
          />
        }
      >
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 sm:px-5 md:px-6">
          {isArenaFreeForm ? (
            <FreeFormArenaProvider session={session}>
              <>
                <header className="relative w-full overflow-hidden border-b-8 border-orange-600 bg-red-950">
                  <div className="relative h-[10.5rem] w-full sm:h-44 md:h-48">
                    <img
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-60"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ39GSjldydFUbzwuEB3E3Zoqpb59SM1E528gR37SSu1GWZzsSG-0Ng3oN1vjDyhtCZoABq-dBuYkbpgKNQxYoU6LPdLvz3TcpeVy9X10PBHNJQFFKYaKJj4o4qcvmGT8u0zdLNP-W8HqpQtiGh46-buLsoOkWbzvYcKiDo_xhrEVq2Zr0JXt7aY6kZV3rRJC-TNAavKixpSU3RMec_iiZXGpwcEmuKybQZtv94fWyZJyvO1ky9yICmnNx2dhEx2H0A43t3M10TFRh"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a0505] via-transparent to-red-950/40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-3 py-2 sm:px-4 sm:py-3">
                      <div className="flex w-full max-w-6xl flex-col items-center gap-1.5 sm:gap-2">
                        <div className="flex w-full flex-col items-center border-4 border-red-900 bg-black/90 px-3 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.75)] sm:px-4 sm:py-2.5 md:px-5 md:py-3">
                          <span className="pixel-text-xs mb-1 uppercase leading-tight tracking-widest text-orange-500">
                            Location: {session.locationLabel}
                          </span>
                          <h1 className="pixel-text-xl text-center font-black leading-tight text-white glow-red normal-case">
                            {session.topicTitle}
                          </h1>
                        </div>
                        <ArenaFreeFormTimeoutTimer
                          sessionMeta={{
                            sessionId: session.id,
                            topicTitle: session.topicTitle,
                            opponentName: session.opponentName,
                            userRole: session.userRole,
                            debateFormat: session.debateFormat,
                            arenaRoomId: session.arenaRoomId,
                          }}
                          roomId={session.arenaRoomId!}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                </header>

                <div className="relative z-10 grid flex-1 grid-cols-12 gap-0">
                  <section className="col-span-12 border-r-4 border-red-950 bg-[#2a0808]/90 p-6 backdrop-blur-sm lg:col-span-3">
                    <h2 className="pixel-text-base mb-8 flex items-center gap-2 font-black uppercase text-red-100">
                      <MaterialIcon name="menu_book" className="text-orange-500" />
                      Arena Free Form
                    </h2>
                    <div className="space-y-6">
                      <div className="border-2 border-red-900 bg-black/60 p-4 shadow-[4px_4px_0px_0px_#7f1d1d]">
                        <h3 className="pixel-text-xs mb-3 font-bold uppercase text-orange-500">
                          Format
                        </h3>
                        <p className="pixel-text-xs text-stone-200">
                          This arena debate is free-form. You and your opponent can argue
                          in your own style without phase restrictions.
                        </p>
                      </div>
                      <div className="border-2 border-red-600 bg-red-950/80 p-4 shadow-[4px_4px_0px_0px_#ba1a1a]">
                        <h3 className="pixel-text-xs mb-3 font-bold uppercase text-red-500">
                          Tip
                        </h3>
                        <p className="pixel-text-xs leading-normal text-red-200">
                          Arena free-form rounds last 3 minutes. Let the timer finish for AI
                          judging; ending early records a forfeit.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section
                    id="debate-chat-area"
                    className="relative col-span-12 flex flex-col border-r-4 border-red-950 bg-[#1a0505] lg:col-span-6"
                  >
                    <DebateChatPanel
                      sessionId={session.id}
                      opponentName={session.opponentName}
                      phaseLabel={session.phaseLabel}
                      debateFormat={session.debateFormat}
                      topicTitle={session.topicTitle}
                      userRole={session.userRole}
                      arenaRoomId={session.arenaRoomId}
                      selfAvatarUrl={session.selfAvatarUrl}
                      opponentAvatarUrl={session.opponentAvatarUrl}
                    />
                  </section>

                  <section className="col-span-12 space-y-10 bg-[#2a0808]/90 p-6 backdrop-blur-sm lg:col-span-3">
                    <ForfeitEndButton
                      sessionMeta={{
                        sessionId: session.id,
                        topicTitle: session.topicTitle,
                        opponentName: session.opponentName,
                        userRole: session.userRole,
                        debateFormat: session.debateFormat,
                        arenaRoomId: session.arenaRoomId,
                      }}
                      className="inline-flex w-full items-center justify-center border-b-4 border-orange-900 bg-orange-600 px-4 py-3 text-white pixel-text-xs font-black uppercase shadow-[4px_4px_0px_0px_#451a03] transition-all hover:bg-orange-500 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                      ariaLabel="End debate now"
                      confirmMessage="End this debate now? This ends the match immediately and records a forfeit loss."
                      modalRootId="debate-chat-area"
                    >
                      End Debate
                    </ForfeitEndButton>
                    <DebateRoleMatchupStrip
                      userRole={session.userRole}
                      opponentName={session.opponentName}
                    />
                  </section>
                </div>
              </>
            </FreeFormArenaProvider>
          ) : (
            <WsdaDebateProvider session={session}>
              <header className="relative w-full overflow-hidden border-b-8 border-orange-600 bg-red-950">
                <div className="relative h-[10.5rem] w-full sm:h-44 md:h-48">
                  <img
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ39GSjldydFUbzwuEB3E3Zoqpb59SM1E528gR37SSu1GWZzsSG-0Ng3oN1vjDyhtCZoABq-dBuYkbpgKNQxYoU6LPdLvz3TcpeVy9X10PBHNJQFFKYaKJj4o4qcvmGT8u0zdLNP-W8HqpQtiGh46-buLsoOkWbzvYcKiDo_xhrEVq2Zr0JXt7aY6kZV3rRJC-TNAavKixpSU3RMec_iiZXGpwcEmuKybQZtv94fWyZJyvO1ky9yICmnNx2dhEx2H0A43t3M10TFRh"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a0505] via-transparent to-red-950/40" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-3 py-2 sm:px-4 sm:py-3">
                    <div className="flex w-full max-w-6xl flex-col items-center gap-1.5 sm:gap-2">
                      <div className="flex w-full flex-col items-center border-4 border-red-900 bg-black/90 px-3 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.75)] sm:px-4 sm:py-2.5 md:px-5 md:py-3">
                        <span className="pixel-text-xs mb-1 uppercase leading-tight tracking-widest text-orange-500">
                          Location: {session.locationLabel}
                        </span>
                        <h1 className="pixel-text-xl text-center font-black leading-tight text-white glow-red normal-case">
                          {session.topicTitle}
                        </h1>
                      </div>
                      <WsdaDebateTimerDisplay />
                    </div>
                  </div>
                </div>
              </header>

              <div className="relative z-10 grid flex-1 grid-cols-12 gap-0">
                <section className="col-span-12 border-r-4 border-red-950 bg-[#2a0808]/90 p-6 backdrop-blur-sm lg:col-span-3">
                  <h2 className="pixel-text-base mb-8 flex items-center gap-2 font-black uppercase text-red-100">
                    <MaterialIcon name="menu_book" className="text-orange-500" />
                    WSDA Rules
                  </h2>
                  <div className="space-y-4">
                    <div className="border-2 border-red-900 bg-black/60 p-4 shadow-[4px_4px_0px_0px_#7f1d1d]">
                      <h3 className="pixel-text-xs mb-3 font-bold uppercase text-orange-500">
                        Order & times
                      </h3>
                      <ol className="pixel-text-xs list-decimal space-y-2 pl-4 text-stone-200">
                        {WSDA_PHASES.map((p, i) => (
                          <li key={`${p.label}-${i}`} className="leading-snug">
                            <span className="font-bold text-orange-200/90">
                              {p.label}
                            </span>
                            <span className="text-stone-400">
                              {" "}
                              ({formatMmSs(p.durationSec)}) [
                              {wsdaActiveSpeakerLabel(p.activeSpeaker)}] —{" "}
                            </span>
                            {p.purpose}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="border-2 border-red-600 bg-red-950/80 p-4 shadow-[4px_4px_0px_0px_#ba1a1a]">
                      <h3 className="pixel-text-xs mb-2 font-bold uppercase text-red-500">
                        Conduct
                      </h3>
                      <p className="pixel-text-xs leading-normal text-red-200">
                        Follow the phase you are in: constructives build your case;
                        cross-ex is questions and direct answers; prep is silent
                        prep; rebuttals refute then (final segment) explain why you
                        win. No ad hominem; stay on the resolution.
                      </p>
                    </div>
                  </div>
                </section>

                <section
                  id="debate-chat-area"
                  className="relative col-span-12 flex flex-col border-r-4 border-red-950 bg-[#1a0505] lg:col-span-6"
                >
                  <WsdaDebateRoom />
                </section>

                <section className="col-span-12 space-y-10 bg-[#2a0808]/90 p-6 backdrop-blur-sm lg:col-span-3">
                  <ForfeitEndButton
                    sessionMeta={{
                      sessionId: session.id,
                      topicTitle: session.topicTitle,
                      opponentName: session.opponentName,
                      userRole: session.userRole,
                      debateFormat: session.debateFormat,
                      arenaRoomId: session.arenaRoomId,
                    }}
                    className="inline-flex w-full items-center justify-center border-b-4 border-orange-900 bg-orange-600 px-4 py-3 text-white pixel-text-xs font-black uppercase shadow-[4px_4px_0px_0px_#451a03] transition-all hover:bg-orange-500 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                    ariaLabel="End debate now"
                    modalRootId="debate-chat-area"
                  >
                    End Debate
                  </ForfeitEndButton>
                  <WsdaRoleMatchupStrip />
                </section>
              </div>
            </WsdaDebateProvider>
          )}
        </main>
      </NetherSidebarShell>

    </div>
  );
}
