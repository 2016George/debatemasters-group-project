"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shown to the player who stayed when the opponent ends the arena debate.
 * Styling matches {@link DebateEndConfirmModal} (scoped portal, pixel frame).
 */
export function OpponentExitNoticeModal({
  open,
  opponentName,
  onOk,
  modalRootId,
}: {
  open: boolean;
  opponentName: string;
  onOk: () => void;
  modalRootId?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
    });
  }, []);

  const scopedRoot =
    isMounted && modalRootId ? document.getElementById(modalRootId) : null;
  const isScopedModal = Boolean(scopedRoot);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOk();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOk]);

  useEffect(() => {
    if (!open || isScopedModal) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open, isScopedModal]);

  if (!open || !isMounted) return null;

  return createPortal(
    <div
      className={
        isScopedModal
          ? "absolute inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          : "fixed inset-0 z-[200] flex min-h-screen items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      }
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Opponent exited the debate"
        className="w-full max-w-md border-4 border-red-900 bg-[#1a0505] p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)] md:p-5 font-headline-pixel"
      >
        <p className="pixel-text-xs font-black uppercase tracking-wide text-orange-500">
          Opponent exited
        </p>
        <p className="debate-chat-body mt-3 text-stone-200 normal-case">
          {opponentName} has ended the debate and left the room. You win this round by
          forfeit. Press OK to open your debate summary.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onOk}
            className="border-b-4 border-orange-900 bg-orange-600 px-4 py-2 pixel-text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.45)] transition-all hover:bg-orange-500 active:translate-y-1 active:shadow-none"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    scopedRoot ?? document.body,
  );
}
