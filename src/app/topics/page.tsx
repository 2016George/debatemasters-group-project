"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NetherSidebarShell } from "@/components/layout/NetherSidebarShell";
import { OnboardingSidebar } from "@/components/sidebars/OnboardingSidebar";
import { MaterialIcon } from "@/components/MaterialIcon";
import {
  isSoloTopicAreaId,
  pickDifferentSoloTopic,
  pickRandomTopicFromPool,
  type SoloTopicAreaId,
} from "@/lib/debate/solo-area-topic-pools";
import { WSDA_PHASES, formatMmSs } from "@/lib/debate/wsda-schedule";
import { getMockTopics } from "@/lib/data/repository";
import { getAgeBandPreference } from "@/lib/data/profile-storage";

const wsdaTotalSeconds = WSDA_PHASES.reduce(
  (sum, phase) => sum + phase.durationSec,
  0,
);

function TopicIcon({ name, className }: { name: string; className?: string }) {
  return <MaterialIcon name={name} className={className} />;
}

const topicCardGoShadow =
  "shadow-[0px_4px_0px_0px_#00497d] hover:shadow-[0px_2px_0px_0px_#00497d]";

export default function TopicsPage() {
  const topics = useMemo(() => getMockTopics(), []);
  const [soloRole, setSoloRole] = useState<"pro" | "con">("pro");

  const [soloTopicLines, setSoloTopicLines] = useState<Partial<Record<string, string>>>(
    {},
  );
  const [soloTopicsReady, setSoloTopicsReady] = useState(false);

  useEffect(() => {
    const band = getAgeBandPreference();
    const next: Record<string, string> = {};
    for (const t of topics) {
      if (isSoloTopicAreaId(t.id)) {
        next[t.id] = pickRandomTopicFromPool(t.id, band);
      }
    }
    setSoloTopicLines(next);
    setSoloTopicsReady(true);
  }, [topics]);

  const rerollSoloTopic = useCallback((areaId: SoloTopicAreaId) => {
    const band = getAgeBandPreference();
    setSoloTopicLines((prev) => ({
      ...prev,
      [areaId]: pickDifferentSoloTopic(areaId, band, prev[areaId] ?? ""),
    }));
  }, []);

  return (
    <div className="bg-background font-[family-name:var(--font-inter)] text-on-background selection:bg-primary selection:text-white">
      <NetherSidebarShell sidebar={<OnboardingSidebar />}>
        <main className="nether-bg-topics relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#ba1a1a20_100%)]" />
          <div className="relative z-10 mx-auto max-w-7xl p-6 md:p-8">
            <Link
              href="/onboarding"
              className="brick-sans mb-8 inline-flex items-center gap-2 border-b-4 border-r-4 border-black bg-[#2D1B19] px-4 py-3 font-black uppercase tracking-widest text-[#58B13E] transition-all hover:bg-[#3a2824] hover:brightness-110 active:translate-y-1 active:border-0"
            >
              <MaterialIcon name="arrow_back" className="text-lg text-[#58B13E]" />
              BACK
            </Link>
            <section className="mb-8 border-l-8 border-primary-fixed bg-stone-900/70 p-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <div>
                  <p className="mb-3 font-headline-pixel text-[8px] font-bold uppercase tracking-widest text-stone-300">
                    Side
                  </p>
                  <div className="inline-flex border-4 border-black bg-stone-950 p-1">
                    <button
                      type="button"
                      onClick={() => setSoloRole("pro")}
                      className={`px-4 py-2 font-headline-pixel text-[10px] font-black uppercase transition-all ${
                        soloRole === "pro"
                          ? "bg-primary text-white shadow-[0px_3px_0px_0px_#085300]"
                          : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                      }`}
                    >
                      Pro
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoloRole("con")}
                      className={`px-4 py-2 font-headline-pixel text-[10px] font-black uppercase transition-all ${
                        soloRole === "con"
                          ? "bg-tertiary text-white shadow-[0px_3px_0px_0px_#00497d]"
                          : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                      }`}
                    >
                      Con
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-3 font-headline-pixel text-[8px] font-bold uppercase tracking-widest text-stone-300">
                    Format — WSDA
                  </p>
                  <p className="mb-3 font-headline-pixel text-[9px] font-bold leading-relaxed text-stone-400">
                    Structured 10-phase round ({formatMmSs(wsdaTotalSeconds)} total).
                    Phases advance automatically with timed speaking segments.
                  </p>
                  <ol className="max-h-48 space-y-1 overflow-y-auto border-2 border-stone-800 bg-stone-950/80 p-3">
                    {WSDA_PHASES.map((phase, index) => (
                      <li
                        key={`${index}-${phase.label}`}
                        className="flex items-baseline justify-between gap-3 font-headline-pixel text-[8px] font-bold text-stone-300"
                      >
                        <span className="min-w-0 flex-1 leading-snug">
                          {index + 1}. {phase.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-orange-400">
                          {formatMmSs(phase.durationSec)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
            <div className="mb-16 flex flex-col gap-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {topics.map((t) => {
                const line = soloTopicLines[t.id];
                const debateHref =
                  soloTopicsReady && line
                    ? `/debate?topic=custom&title=${encodeURIComponent(line)}&role=${soloRole}&format=wsda`
                    : null;

                const inner = (
                  <>
                    <div className="absolute top-0 right-0 flex h-16 w-16 items-center justify-center bg-tertiary-container/20">
                      <TopicIcon
                        name={t.icon}
                        className={`text-4xl ${
                          t.id === "village-hall" ? "text-primary" : "text-tertiary"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="mb-4 inline-block bg-tertiary px-3 py-1">
                        <span className="font-headline-pixel text-[8px] font-black uppercase tracking-tighter text-white">
                          {t.badge}
                        </span>
                      </div>
                      <h3 className="mb-2 font-headline-pixel text-xl font-black uppercase leading-tight text-on-surface">
                        {t.title}
                      </h3>
                      <p className="min-h-[3.25rem] font-headline-pixel text-[10px] font-bold leading-relaxed text-on-surface-variant">
                        {!soloTopicsReady ? (
                          <span className="text-on-surface-variant/50">Loading topic…</span>
                        ) : (
                          line
                        )}
                      </p>
                    </div>
                  </>
                );

                const canReroll = soloTopicsReady && isSoloTopicAreaId(t.id);

                const btn = debateHref ? (
                  <Link
                    href={debateHref}
                    className={`relative flex w-full items-center justify-center gap-2 bg-tertiary py-3 px-6 font-headline-pixel text-[10px] font-black text-white transition-all hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none ${topicCardGoShadow}`}
                  >
                    GO <TopicIcon name="play_arrow" className="text-sm" />
                  </Link>
                ) : (
                  <span
                    className={`relative flex w-full cursor-not-allowed items-center justify-center gap-2 bg-stone-600 py-3 px-6 font-headline-pixel text-[10px] font-black text-stone-300 ${topicCardGoShadow}`}
                  >
                    GO <TopicIcon name="play_arrow" className="text-sm" />
                  </span>
                );

                  return (
                    <div
                      key={t.id}
                      className="group relative flex min-h-[22rem] flex-col justify-between border-b-8 border-r-8 border-stone-950 bg-surface-container-low p-6 voxel-glow transition-all hover:-translate-y-1 active:translate-y-1"
                    >
                      {inner}
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={!canReroll}
                          onClick={() => {
                            if (isSoloTopicAreaId(t.id)) rerollSoloTopic(t.id);
                          }}
                          className={`inline-flex items-center justify-center gap-1 border-2 border-tertiary bg-transparent px-3 py-2 font-headline-pixel text-[8px] font-black uppercase tracking-tight text-tertiary transition-all ${
                            canReroll
                              ? "hover:bg-tertiary/10 active:translate-y-px"
                              : "cursor-not-allowed opacity-40"
                          }`}
                          aria-label={`Pick another random topic for ${t.title}`}
                        >
                          <MaterialIcon name="refresh" className="text-sm" />
                          New topic
                        </button>
                        {btn}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="voxel-glow relative flex flex-col gap-6 overflow-hidden border-4 border-primary bg-stone-900 p-8">
                <div className="absolute -bottom-4 -right-4 flex h-32 w-32 rotate-12 items-center justify-center bg-primary/20">
                  <MaterialIcon
                    name="edit_note"
                    className="text-8xl text-primary/40"
                    filled
                  />
                </div>
                <div className="relative z-10">
                  <h2 className="mb-2 font-headline-pixel text-2xl font-black uppercase italic text-white">
                    EXCAVATE YOUR OWN
                  </h2>
                  <p className="font-headline-pixel text-[10px] font-bold leading-relaxed text-stone-400">
                    Don&apos;t see a biome you like? Design your own debate topic
                    from scratch.
                  </p>
                </div>
                <form
                  action="/debate"
                  method="get"
                  className="relative z-10 flex flex-col gap-4 md:flex-row"
                >
                  <input type="hidden" name="topic" value="custom" />
                  <input type="hidden" name="role" value={soloRole} />
                  <input type="hidden" name="format" value="wsda" />
                  <div className="group flex-1">
                    <input
                      name="title"
                      required
                      className="font-headline-pixel w-full border-none bg-stone-800 p-4 font-bold text-[10px] text-white placeholder:text-stone-600 shadow-[inset_4px_4px_0px_0px_#000] focus:ring-4 focus:ring-tertiary"
                      placeholder="ENTER TOPIC NAME..."
                      type="text"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-primary px-12 py-4 text-center font-headline-pixel text-sm font-black uppercase text-white shadow-[4px_4px_0px_0px_#085300] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:scale-95"
                  >
                    GO
                  </button>
                </form>
              </div>
            </div>

          </div>
          <div className="pointer-events-none absolute bottom-10 right-10 h-24 w-24 rounded-full bg-red-600/30 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/4 h-16 w-16 rounded-full bg-orange-600/20 blur-2xl" />
        </main>
      </NetherSidebarShell>
    </div>
  );
}
