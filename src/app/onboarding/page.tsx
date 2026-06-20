"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { AgeBand } from "@/lib/data/types";
import {
  getAgeBandPreference,
  setAgeBandPreference,
} from "@/lib/data/profile-storage";

export default function OnboardingPage() {
  const [age, setAge] = useState<AgeBand>("10-14");
  const [agePreferenceLoaded, setAgePreferenceLoaded] = useState(false);

  useEffect(() => {
    setAge(getAgeBandPreference());
    setAgePreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!agePreferenceLoaded) return;
    setAgeBandPreference(age);
  }, [age, agePreferenceLoaded]);

  return (
    <div className="theme-nether-dark selection:bg-[#58B13E] selection:text-black relative min-h-screen overflow-x-hidden bg-[#1A0806] font-[family-name:var(--font-inter)] text-white nether-bg-onboarding">
      <NetherSidebarShell sidebar={<OnboardingSidebar />}>
        <main className="flex min-h-screen min-w-0 flex-col items-center px-4 py-10 sm:px-6 md:px-10 md:py-14 lg:px-12 lg:py-16 xl:px-14">
          <div className="grid w-full min-w-0 max-w-5xl grid-cols-1 items-start gap-10 md:gap-12 lg:grid-cols-12 xl:max-w-6xl 2xl:max-w-7xl">
            <div className="min-w-0 space-y-6 lg:col-span-4">
              <h1 className="brick-sans text-4xl font-black uppercase leading-none tracking-tighter text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,0.8)] md:text-5xl">
                CHOOSE <br />
                YOUR <span className="text-[#58B13E]">PATH</span>
              </h1>
              <p className="max-w-prose border-l-4 border-[#58B13E] pl-4 text-base leading-relaxed text-[#b8b8b8] sm:text-lg">
                The bedrock of every great debater is their journey. Select the
                mode that matches your energy.
              </p>
              <div className="pt-8">
                <h3 className="brick-sans mb-4 text-lg font-bold uppercase text-white">
                  HOW OLD ARE YOU?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["under10", "Under 10"],
                      ["10-14", "10-14"],
                      ["15-18", "15-18"],
                      ["18+", "18 Above"],
                    ] as const
                  ).map(([id, label]) => {
                    const active = age === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAge(id)}
                        className={`brick-sans border-b-4 border-r-4 px-4 py-2 text-xs font-black transition-all active:translate-y-1 active:border-0 ${
                          active
                            ? "translate-y-1 border-0 bg-[#58B13E] text-white shadow-none"
                            : "border-black bg-[#2D1B19] text-white hover:bg-[#3a2420]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-8 md:grid-cols-2 lg:col-span-8">
              <div className="group relative min-w-0 border-4 border-[#5c3530] bg-[#2D1B19] p-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1">
                <div className="space-y-4 bg-[#2D1B19] p-6">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b-4 border-black bg-[#dce8e0]">
                    <img
                      alt=""
                      className="h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqjz2Qc_RmuZBxcMzNI6wlA6c-zh24w_Kn9Q8lfc39cU9hCdVMVWOy6Q3wpRrGwU3pw7cMPFYeOg1mSAd_nV6Qnwv1x02ZRS0xylfJqk3eicMDveT_6E230cH2WZwAadlcs2m_wBBeeHiRFDG_ln0OqAYErGOxZPlE3kiC8EGA6F1Nhy0EHEAEfon-C6x7nLz6NG7B2cIiv-gHsYDPdEc7uo765GNbtMYoxCXQ0R5aaDUk55Z0CMLkcQDIbGVZpwa-gPe2F7WHeIpK"
                    />
                  </div>
                  <div>
                    <h2 className="brick-sans text-xl font-black uppercase text-white">
                      Solo Path
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#b8b8b8]">
                      Practice a full WSDA round against an AI opponent — 10 timed
                      phases from constructive speeches through cross-examination,
                      rebuttals, and conclusion speeches (~16 minutes).
                    </p>
                  </div>
                  <div className="pt-4">
                    <Link
                      href="/topics"
                      prefetch={false}
                      className="brick-sans block w-full border-b-4 border-r-4 border-[#1565C0] bg-[#2196F3] px-2 py-4 text-center text-xs font-black uppercase tracking-wide text-black transition-all hover:brightness-110 active:translate-y-1 active:border-0 sm:text-sm sm:tracking-widest"
                    >
                      SELECT SOLO
                    </Link>
                  </div>
                </div>
              </div>

              <div className="group relative min-w-0 border-4 border-[#58B13E] bg-[#2D1B19] p-1 shadow-[8px_8px_0px_0px_rgba(88,177,62,0.25)] transition-transform hover:-translate-y-1">
                <div className="space-y-4 bg-[#2D1B19] p-6">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b-4 border-black bg-[#1a1518]">
                    <img
                      alt=""
                      className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOz0nb0F9sBtQJTHf1hP1K5C-U-GolTgBDro5RfUwF1bi_S-2yZ1fLYH9lsbamd1wwbYHdSJRKctAicC0uuF2QuQ1pzFV32yI-iJWQqavrQaeNiqhKFfzJapOuUct94eNIXK7j0IYfwMdJB9rxaZVDJUqyVG7cCSFUtBqkYTiLF5kLIic7BglV07mkzkTvUoss6UDPcv5rh0T29rWFwZTqwkC-6XWc8HkaFsq-nUvlgEBnhWc5uib5UhX12fqu8_CgJ6_cxLndQm9H"
                    />
                    <div className="absolute right-2 top-2 bg-[#58B13E] px-2 py-1 text-[8px] font-black uppercase text-white brick-sans">
                      Recommended
                    </div>
                  </div>
                  <div>
                    <h2 className="brick-sans text-xl font-black uppercase text-white">
                      The Arena
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#b8b8b8]">
                      Face off against real debaters worldwide. Climb the rankings
                      and become a Master Builder.
                    </p>
                  </div>
                  <div className="pt-4">
                    <Link
                      href="/arena/setup"
                      prefetch={false}
                      className="brick-sans block w-full border-b-4 border-r-4 border-[#3d8a2e] bg-[#58B13E] px-2 py-4 text-center text-xs font-black uppercase tracking-wide text-white transition-all hover:brightness-110 active:translate-y-1 active:border-0 sm:text-sm sm:tracking-widest"
                    >
                      ENTER ARENA
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </NetherSidebarShell>

      <div className="pointer-events-none fixed bottom-8 left-[280px] hidden text-[#58B13E] opacity-15 lg:block">
        <MaterialIcon name="architecture" className="text-[120px]" />
      </div>
      <div className="pointer-events-none fixed right-12 top-24 hidden text-[#58B13E] opacity-15 lg:block">
        <MaterialIcon name="view_in_ar" className="text-[80px]" />
      </div>
    </div>
  );
}
