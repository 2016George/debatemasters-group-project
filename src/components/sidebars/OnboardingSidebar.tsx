"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { MaterialIcon } from "../MaterialIcon";
import { isSupabaseConfigured } from "@/lib/supabase/browser-client";
import type { ForfeitMeta } from "@/lib/data/history-storage";
import { recordDebaterExit } from "@/lib/data/debater-exit";
import { DebateEndConfirmModal } from "@/components/debate/DebateEndConfirmModal";
import {
  clearLocalProfileCacheAfterSignOut,
  ensureUserProfileInitialized,
  useUserProfile,
} from "@/lib/data/profile-storage";

export function OnboardingSidebar({
  leaveGuardSessionMeta,
}: {
  leaveGuardSessionMeta?: ForfeitMeta;
}) {
  const user = useUserProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [pendingExitHref, setPendingExitHref] = useState<string | null>(null);
  const homeActive = pathname === "/onboarding";
  const historyActive = pathname.startsWith("/results");
  const profileActive = pathname.startsWith("/profile");
  const guardEnabled =
    Boolean(leaveGuardSessionMeta) && pathname.startsWith("/debate");

  useEffect(() => {
    ensureUserProfileInitialized();
  }, []);

  const itemBase =
    "group flex items-center border-l-4 px-6 py-4 transition-colors hover:bg-stone-900";
  const active = `${itemBase} border-primary text-white`;
  const inactive = `${itemBase} border-transparent text-stone-400 hover:text-white`;

  function handleGuardedNavClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!guardEnabled || isLeaving) return;
    event.preventDefault();
    setPendingExitHref(event.currentTarget.getAttribute("href"));
    setShowLeaveConfirm(true);
  }

  return (
    <>
      <div className="flex h-full flex-col py-8">
        <div className="mb-8 px-6">
          <div className="brick-sans mb-4 text-xl font-black uppercase leading-tight tracking-tighter text-white">
            Debate <br /> Master
          </div>
          <div className="h-1 w-12 bg-primary" />
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            href="/onboarding"
            className={homeActive ? active : inactive}
            onClick={handleGuardedNavClick}
          >
            <MaterialIcon name="home" className="mr-4" />
            <span className="brick-sans text-sm font-black uppercase tracking-widest">
              Home
            </span>
          </Link>
          <Link
            href="/results"
            className={historyActive ? active : inactive}
            onClick={handleGuardedNavClick}
          >
            <MaterialIcon name="history" className="mr-4" />
            <span className="brick-sans text-sm font-black uppercase tracking-widest">
              History
            </span>
          </Link>
        </nav>

        <div className="mt-auto border-t border-stone-700 px-6 pt-4">
          <Link
            href="/profile"
            onClick={handleGuardedNavClick}
            className={`mb-4 block border-2 p-2 transition-colors ${
              profileActive
                ? "border-primary bg-stone-900"
                : "border-transparent hover:border-stone-700 hover:bg-stone-900/70"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border-2 border-stone-600 bg-stone-950">
                <img
                  src={user.avatarUrl}
                  alt={`${user.displayName} avatar`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="brick-sans pixel-text-sm font-black uppercase tracking-wide text-stone-500">
                  Profile
                </div>
                <div className="brick-sans truncate text-xs font-black uppercase tracking-wide text-white">
                  {user.displayName}
                </div>
              </div>
            </div>
          </Link>
          <Link
            href="/login"
            onClick={async (e) => {
              if (guardEnabled && pathname.startsWith("/debate")) {
                handleGuardedNavClick(e as unknown as MouseEvent<HTMLAnchorElement>);
                return;
              }
              e.preventDefault();
              if (isSupabaseConfigured()) {
                clearLocalProfileCacheAfterSignOut();
                window.location.href = "/auth/sign-out";
                return;
              }
              window.location.href = "/login";
            }}
            className="group mt-4 flex w-full items-center justify-center gap-2 border-2 border-stone-600 bg-stone-950 py-3 transition-colors hover:border-red-800 hover:bg-red-950/80"
          >
            <MaterialIcon
              name="logout"
              className="text-lg text-stone-400 transition-colors group-hover:text-white"
            />
            <span className="brick-sans text-xs font-black uppercase tracking-widest text-stone-300 transition-colors group-hover:text-white">
              Logout
            </span>
          </Link>
        </div>
      </div>
      <DebateEndConfirmModal
        open={showLeaveConfirm}
        isBusy={isLeaving}
        confirmMessage="Leave this debate room and end the debate?"
        modalRootId="debate-chat-area"
        onCancel={() => {
          setShowLeaveConfirm(false);
          setPendingExitHref(null);
        }}
        onConfirm={async () => {
          if (!leaveGuardSessionMeta || isLeaving) return;
          setIsLeaving(true);
          try {
            const outcome = await recordDebaterExit(leaveGuardSessionMeta);
            let destination: string;
            if (outcome.type === "already_self") {
              destination = pendingExitHref ?? "/results";
            } else if (pendingExitHref === "/results") {
              destination = `/results/${encodeURIComponent(outcome.resultId)}`;
            } else {
              destination = pendingExitHref ?? "/results";
            }
            if (destination === "/login" && isSupabaseConfigured()) {
              clearLocalProfileCacheAfterSignOut();
              window.location.href = "/auth/sign-out";
              return;
            }
            router.push(destination);
          } finally {
            setIsLeaving(false);
          }
        }}
      />
    </>
  );
}
