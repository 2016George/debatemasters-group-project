"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";
import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";
import {
  ensureUserProfileInitialized,
  MINECRAFT_AVATAR_OPTIONS,
  useUserProfile,
  updateUserProfile,
} from "@/lib/data/profile-storage";
import { xpProgressWithinLevel } from "@/lib/progression/experience";

export default function ProfilePage() {
  const user = useUserProfile();
  const [displayName, setDisplayName] = useState(() => user.displayName);
  const [selectedAvatar, setSelectedAvatar] = useState(() => user.avatarUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ensureUserProfileInitialized();
  }, []);

  useEffect(() => {
    setDisplayName(user.displayName);
    setSelectedAvatar(user.avatarUrl);
  }, [user.displayName, user.avatarUrl]);

  async function saveProfile() {
    const cleaned = displayName.trim().slice(0, 24);
    if (!cleaned) return;
    await updateUserProfile({ displayName: cleaned, avatarUrl: selectedAvatar });
    setDisplayName(cleaned);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  const canSave =
    displayName.trim().length > 0 &&
    (displayName.trim() !== user.displayName || selectedAvatar !== user.avatarUrl);

  const xpBar = xpProgressWithinLevel(user.totalExperience);
  const xpFillPct = Math.min(
    100,
    Math.round((xpBar.intoLevel / Math.max(1, xpBar.xpForNextLevel)) * 100),
  );

  return (
    <div className="results-nether-bg relative min-h-screen overflow-x-hidden font-app text-white">
      <div className="nether-haze-results" />
      <div className="crimson-particles" />
      <NetherSidebarShell sidebar={<OnboardingSidebar />}>
        <main className="relative z-10 mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-14">
          <Link
            href="/onboarding"
            className="brick-sans mb-8 inline-flex items-center gap-2 border-b-4 border-r-4 border-black bg-[#2D1B19] px-4 py-3 font-black uppercase tracking-widest text-[#58B13E] transition-all hover:bg-[#3a2824] hover:brightness-110 active:translate-y-1 active:border-0"
          >
            <MaterialIcon name="arrow_back" className="text-lg text-[#58B13E]" />
            BACK
          </Link>

          <section className="mb-8 grid gap-4 border-4 border-stone-800 bg-black/70 p-5 shadow-[8px_8px_0_0_rgba(0,0,0,0.75)] md:grid-cols-[7rem_1fr] md:p-6">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden border-4 border-primary bg-stone-900 md:mx-0">
              <img
                src={selectedAvatar}
                alt={`${displayName} avatar preview`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="display-name"
                  className="brick-sans mb-2 block text-xs font-black uppercase tracking-widest text-stone-400"
                >
                  Username
                </label>
                <input
                  id="display-name"
                  value={displayName}
                  maxLength={24}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="brick-sans w-full border-2 border-stone-700 bg-stone-900 px-3 py-3 text-sm font-black uppercase tracking-wide text-white outline-none transition-colors focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 text-xs uppercase tracking-wide sm:grid-cols-2">
                <div className="border-2 border-stone-700 bg-stone-900/80 p-3">
                  <div className="brick-sans text-stone-500">Advancement</div>
                  <div className="brick-sans mt-1 text-sm font-black text-green-400">
                    {user.rankLabel}
                  </div>
                </div>
                <div className="border-2 border-stone-700 bg-stone-900/80 p-3">
                  <div className="brick-sans text-stone-500">Player level</div>
                  <div className="brick-sans mt-1 text-sm font-black text-orange-300">
                    {user.level}
                  </div>
                </div>
              </div>
              <div className="border-2 border-[#2d5a24] bg-[#142214] p-3">
                <div className="brick-sans pixel-text-sm mb-2 font-black uppercase tracking-widest text-[#7bdc6a]">
                  Experience bar
                </div>
                <div className="h-4 border-2 border-black bg-stone-950">
                  <div
                    className="h-full bg-[#58B13E]"
                    style={{ width: `${xpFillPct}%` }}
                  />
                </div>
                <div className="brick-sans pixel-text-sm mt-2 font-bold uppercase tracking-wide text-stone-500">
                  {xpBar.intoLevel} / {xpBar.xpForNextLevel} XP — {user.totalExperience} orbs total
                </div>
              </div>
            </div>
          </section>

          <section className="border-4 border-stone-800 bg-black/70 p-5 shadow-[8px_8px_0_0_rgba(0,0,0,0.75)] md:p-6">
            <h2 className="brick-sans mb-4 text-lg font-black uppercase tracking-wide text-white">
              Choose Avatar
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {MINECRAFT_AVATAR_OPTIONS.map((avatar) => {
                const active = selectedAvatar === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.url)}
                    className={`border-4 p-3 transition-transform hover:-translate-y-0.5 ${
                      active
                        ? "border-primary bg-primary/20"
                        : "border-stone-700 bg-stone-900 hover:border-stone-500"
                    }`}
                  >
                    <div className="mx-auto mb-2 h-16 w-16 overflow-hidden border-2 border-black bg-stone-950">
                      <img
                        src={avatar.url}
                        alt={avatar.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="brick-sans pixel-text-sm font-black uppercase tracking-wider text-white">
                      {avatar.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={!canSave}
              className={`brick-sans inline-flex items-center gap-2 border-b-4 border-r-4 px-6 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                canSave
                  ? "border-[#3d8a2e] bg-[#58B13E] text-white hover:brightness-110 active:translate-y-1 active:border-0"
                  : "cursor-not-allowed border-stone-800 bg-stone-700 text-stone-400"
              }`}
            >
              <MaterialIcon name="save" className="text-base" />
              Save Profile
            </button>
            {saved ? (
              <span className="brick-sans text-xs font-black uppercase tracking-wider text-primary">
                Profile updated!
              </span>
            ) : null}
          </div>
        </main>
      </NetherSidebarShell>
    </div>
  );
}
