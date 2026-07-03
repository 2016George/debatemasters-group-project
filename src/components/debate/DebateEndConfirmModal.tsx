"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function DebateEndConfirmModal({
  open,
  isBusy,
  confirmMessage,
  onCancel,
  onConfirm,
  modalRootId,
}: {
  open: boolean;
  isBusy: boolean;
  confirmMessage: string;
  onCancel: () => void;
  onConfirm: () => void;
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
      if (event.key === "Escape" && !isBusy) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isBusy, onCancel]);

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
        aria-label="Confirm end debate"
        className="w-full max-w-md border-4 border-red-900 bg-[#1a0505] p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.8)] md:p-5 font-headline-pixel"
      >
        <p className="pixel-text-xs font-black uppercase tracking-wide text-orange-500">
          Confirm End Debate
        </p>
        <p className="debate-chat-body mt-3 text-stone-200 normal-case">
          {confirmMessage}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="border-b-4 border-stone-800 bg-stone-700 px-3 py-2 pixel-text-xs font-black uppercase text-stone-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.45)] transition-all enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="border-b-4 border-orange-900 bg-orange-600 px-3 py-2 pixel-text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.45)] transition-all enabled:hover:bg-orange-500 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Ending..." : "End Debate"}
          </button>
        </div>
      </div>
    </div>,
    scopedRoot ?? document.body,
  );
}
