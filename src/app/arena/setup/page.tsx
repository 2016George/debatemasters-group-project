"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";
import type { ArenaDebateFormat } from "@/lib/matchmaking/arena";

type FormatCard = {
  id: ArenaDebateFormat;
  title: string;
  subtitle: string;
  details: string;
  icon: string;
  accent: string;
};

const FORMAT_CARDS: FormatCard[] = [
  {
    id: "free_form",
    title: "Free Form",
    subtitle: "Open chat debate",
    details:
      "No speech phases. You and your opponent can exchange arguments naturally. Arena free-form rounds always run for 3 minutes.",
    icon: "chat",
    accent: "border-blue-600 bg-blue-700",
  },
  {
    id: "wsda",
    title: "WSDA",
    subtitle: "Structured round",
    details:
      "Classic World Schools format with timed phases, speaking turns, and rebuttal structure. Uses current arena WSDA rules unchanged.",
    icon: "gavel",
    accent: "border-[#3d8a2e] bg-[#58B13E]",
  },
];

export default function ArenaSetupPage() {
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<ArenaDebateFormat>("free_form");

  const queueHref = useMemo(
    () => `/matchmaking?format=${encodeURIComponent(selectedFormat)}`,
    [selectedFormat],
  );

  return (
    <div className="theme-nether-dark selection:bg-[#58B13E] selection:text-black relative min-h-screen overflow-x-hidden bg-[#1A0806] font-app text-white">
      <NetherSidebarShell sidebar={<OnboardingSidebar />}>
        <main className="nether-bg-topics relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#ba1a1a20_100%)]" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10 md:py-12">
          <Link
            href="/onboarding"
            className="brick-sans mb-8 self-start inline-flex items-center gap-2 border-b-4 border-r-4 border-black bg-[#2D1B19] px-4 py-3 font-black uppercase tracking-widest text-[#58B13E] transition-all hover:bg-[#3a2824] hover:brightness-110 active:translate-y-1 active:border-0"
          >
            <MaterialIcon name="arrow_back" className="text-lg text-[#58B13E]" />
            Back
          </Link>

          <section className="mb-8 border-l-8 border-[#58B13E] bg-[#2D1B19]/90 p-6">
            <h1 className="brick-sans text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
              Arena Format
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-300 md:text-base">
              Pick how this arena match should run before entering matchmaking. You will
              only be paired with players who selected the same format.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {FORMAT_CARDS.map((format) => {
              const selected = selectedFormat === format.id;
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedFormat(format.id)}
                  className={`group text-left border-4 p-6 transition-all ${
                    selected
                      ? `${format.accent} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.55)]`
                      : "border-stone-700 bg-[#2D1B19] hover:-translate-y-1 hover:border-stone-500"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border-2 border-black/50 bg-black/30">
                      <MaterialIcon name={format.icon} className="text-2xl text-white" />
                    </div>
                    <div>
                      <p className="brick-sans text-xl font-black uppercase text-white">
                        {format.title}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-200">
                        {format.subtitle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-stone-100">{format.details}</p>
                  {selected ? (
                    <p className="brick-sans mt-4 text-xs font-black uppercase tracking-widest text-white">
                      Selected
                    </p>
                  ) : null}
                </button>
              );
            })}
          </section>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => router.push(queueHref)}
              className="brick-sans border-b-4 border-r-4 border-black bg-[#58B13E] px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:brightness-110 active:translate-y-1 active:border-0"
            >
              Start Matchmaking
            </button>
          </div>
          </div>
        </main>
      </NetherSidebarShell>
    </div>
  );
}
