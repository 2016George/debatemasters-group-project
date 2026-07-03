"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DebateRoomTimer } from "@/components/DebateRoomTimer";
import { finalizeDebateWithAi } from "@/lib/data/debate-finalize";
import type { ForfeitMeta } from "@/lib/data/history-storage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/browser-client";

const FREE_FORM_TOTAL_SECONDS = 180;

export function ArenaFreeFormTimeoutTimer({
  sessionMeta,
  roomId,
  compact = false,
}: {
  sessionMeta: ForfeitMeta;
  roomId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [didExpire, setDidExpire] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [serverClock, setServerClock] = useState<{
    startedAtMs: number;
    offsetMs: number;
  } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured() || !roomId) return;
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data: beginData, error: beginError } = await supabase.rpc(
        "arena_begin_free_form_session",
        {
          p_room: roomId,
        },
      );
      if (!cancelled && !beginError) {
        const startedEpoch = Number(
          (beginData as { free_form_started_epoch?: string | number } | null)
            ?.free_form_started_epoch,
        );
        const serverNowEpoch = Number(
          (beginData as { server_now_epoch?: string | number } | null)?.server_now_epoch,
        );
        if (Number.isFinite(startedEpoch) && Number.isFinite(serverNowEpoch)) {
          setServerClock({
            startedAtMs: startedEpoch * 1000,
            offsetMs: serverNowEpoch * 1000 - Date.now(),
          });
          return;
        }
      }
      if (beginError) {
        console.warn("arena_begin_free_form_session failed, using legacy anchor:", beginError);
      }

      // Legacy fallback: in case migration has not been applied yet.
      const [{ data: room }, { data: nowData }] = await Promise.all([
        supabase
          .from("debate_rooms")
          .select("created_at")
          .eq("id", roomId)
          .maybeSingle(),
        supabase.rpc("arena_server_time"),
      ]);
      if (cancelled) return;
      const startedAtRaw = room?.created_at;
      const startedAtMs = startedAtRaw ? Date.parse(startedAtRaw) : Date.now();
      const serverNowEpoch = (nowData as { server_now_epoch?: number } | null)?.server_now_epoch;
      const offsetMs = typeof serverNowEpoch === "number" ? serverNowEpoch * 1000 - Date.now() : 0;
      setServerClock({ startedAtMs, offsetMs });
    })();

    const syncId = window.setInterval(() => {
      void supabase.rpc("arena_server_time").then(({ data }) => {
        if (cancelled || !data) return;
        const serverNowEpoch = (data as { server_now_epoch?: number }).server_now_epoch;
        if (typeof serverNowEpoch !== "number") return;
        setServerClock((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            offsetMs: serverNowEpoch * 1000 - Date.now(),
          };
        });
      });
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(syncId);
    };
  }, [roomId]);

  useEffect(() => {
    if (!serverClock) return;
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, [serverClock]);

  const syncedSecondsLeft = useMemo(() => {
    if (!serverClock) return FREE_FORM_TOTAL_SECONDS;
    const elapsedSec = Math.max(
      0,
      Math.floor((Date.now() + serverClock.offsetMs - serverClock.startedAtMs) / 1000),
    );
    return Math.max(0, FREE_FORM_TOTAL_SECONDS - elapsedSec);
  }, [serverClock, tick]);

  useEffect(() => {
    if (syncedSecondsLeft > 0 || didExpire) return;
    setDidExpire(true);
    window.dispatchEvent(
      new CustomEvent("solo-debate-time-up", {
        detail: { sessionId: sessionMeta.sessionId },
      }),
    );
    setShowTimeoutModal(true);
  }, [didExpire, sessionMeta.sessionId, syncedSecondsLeft]);

  return (
    <>
      <DebateRoomTimer
        isSoloAi={false}
        staticMmSs="03:00"
        controlledSeconds={syncedSecondsLeft}
        compact={compact}
      />
      {showTimeoutModal ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Debate time is up"
            className="w-full max-w-md border-4 border-red-900 bg-[#1a0505] p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)] md:p-5 font-headline-pixel"
          >
            <p className="pixel-text-xs font-black uppercase tracking-wide text-orange-500">
              Time Is Up
            </p>
            <p className="debate-chat-body mt-3 text-stone-200 normal-case">
              The free-form arena round has ended. Click OK to resolve results.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={isResolving}
                onClick={() => {
                  if (isResolving) return;
                  setIsResolving(true);
                  setResolveError(null);
                  void (async () => {
                    try {
                      for (let attempt = 0; attempt < 3; attempt += 1) {
                        const judged = await finalizeDebateWithAi(sessionMeta);
                        if (judged.ok) {
                          router.push(
                            `/results/${encodeURIComponent(judged.resultId)}`,
                          );
                          return;
                        }
                        if (attempt < 2) {
                          await new Promise((resolve) =>
                            window.setTimeout(resolve, 800),
                          );
                        } else {
                          setResolveError(
                            judged.error ||
                              "Could not resolve AI judgment yet. Please try again.",
                          );
                        }
                      }
                    } finally {
                      setIsResolving(false);
                    }
                  })();
                }}
                className="border-b-4 border-orange-900 bg-orange-600 px-4 py-2 pixel-text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.45)] transition-all enabled:hover:bg-orange-500 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResolving ? "Loading..." : "OK"}
              </button>
            </div>
            {resolveError ? (
              <p className="debate-chat-body mt-3 text-amber-300 normal-case">
                {resolveError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
