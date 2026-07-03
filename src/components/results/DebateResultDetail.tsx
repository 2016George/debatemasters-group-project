"use client";

import { MaterialIcon } from "@/components/MaterialIcon";
import { WsdaJudgeScoreBreakdown } from "@/components/results/WsdaJudgeScoreBreakdown";
import { downloadDebateTranscriptPdf } from "@/lib/pdf/transcript-pdf";
import type { DebateResult } from "@/lib/data/types";

const sans =
  "font-[family-name:var(--font-inter)] antialiased text-pretty" as const;

const topicTitleClass =
  "font-headline-pixel text-balance text-base font-black uppercase tracking-tight text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,0.75)] !leading-[1.9] sm:text-lg sm:!leading-[2] md:text-xl md:!leading-[2.1]";

/** Main hero on result page — topic only (Press Start / Minecraft-style pixel font). */
function ResultTopicTitle({ topicTitle }: { topicTitle: string }) {
  return <h1 className={topicTitleClass}>{topicTitle}</h1>;
}

export function DebateResultDetail({ r }: { r: DebateResult }) {
  const wsda = r.scores.wsda;

  return (
    <div className={`relative z-20 mx-auto max-w-5xl p-8 md:p-12 ${sans}`}>
      <div className="mx-auto mb-12 max-w-4xl text-center">
        <ResultTopicTitle topicTitle={r.topicTitle} />
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="relative group">
          <div className="absolute -top-4 -left-4 h-full w-full bg-black" />
          <div className="relative border-4 border-secondary bg-stone-100 p-6 shadow-lg md:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-stone-300 pb-4">
              <MaterialIcon
                name="menu_book"
                className="scale-125 text-secondary"
                filled
              />
              <h2 className="text-lg font-bold uppercase tracking-wide text-secondary md:text-xl">
                Master&apos;s feedback
              </h2>
            </div>
            <div className="space-y-4 leading-relaxed text-stone-900">
              <p className="clearfix text-base font-normal first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-extrabold first-letter:text-5xl first-letter:leading-none first-letter:text-primary">
                {r.feedback}
              </p>
              <div className="border-l-4 border-primary bg-stone-200/90 p-4 text-sm italic leading-relaxed text-stone-800">
                &quot;{r.quote}&quot;
              </div>
              {wsda ? <WsdaJudgeScoreBreakdown wsda={wsda} /> : null}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="border-2 border-primary bg-primary-fixed-dim/90 p-4">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-800">
                    {wsda ? "XP — Clarity" : "Clarity"}
                  </span>
                  <span className="text-3xl font-extrabold tabular-nums text-stone-900">
                    {r.scores.clarity}
                    <span className="ml-1 text-base font-bold text-stone-700">
                      /5
                    </span>
                  </span>
                </div>
                <div className="border-2 border-tertiary bg-tertiary-fixed-dim/90 p-4">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-800">
                    {wsda ? "XP — Evidence" : "Evidence"}
                  </span>
                  <span className="text-3xl font-extrabold tabular-nums text-stone-900">
                    {r.scores.evidence}
                    <span className="ml-1 text-base font-bold text-stone-700">
                      /5
                    </span>
                  </span>
                </div>
              </div>
              <div className="mt-4 border-2 border-[#2d5a24] bg-[#1a2218] p-4">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#7bdc6a]">
                    Experience orbs
                  </span>
                  <span className="text-lg font-black tabular-nums text-[#58B13E]">
                    +{r.xpEarned} XP
                  </span>
                </div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Player level {r.level}
                </div>
                <div className="h-3 border-2 border-black bg-stone-950">
                  <div
                    className="h-full bg-[#58B13E] transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((r.xpCurrent / Math.max(1, r.xpToNext)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  {r.xpCurrent} / {r.xpToNext} toward next level
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-0 h-6 w-3/4 border-x-8 border-black bg-stone-800 shadow-[0_4px_0_#000]" />
          <div className="mx-auto mt-0 h-4 w-1/2 border-x-8 border-black bg-stone-900 shadow-[0_4px_0_#000]" />
        </div>

      </div>

      <section className="mt-14 border-4 border-stone-800 bg-black/75 p-5 pixel-shadow md:p-6">
        <h3 className="mb-4 flex items-center gap-2 border-b border-stone-700 pb-2 text-sm font-bold uppercase tracking-wide text-stone-100 md:text-base">
          <MaterialIcon name="history_edu" />
          Full transcript
        </h3>
        <button
          type="button"
          onClick={() => downloadDebateTranscriptPdf(r)}
          disabled={r.transcript.length === 0}
          className="brick-sans inline-flex items-center gap-2 border-b-4 border-r-4 border-black bg-[#2D1B19] px-5 py-3 font-black uppercase tracking-widest text-[#58B13E] transition-all hover:bg-[#3a2824] hover:brightness-110 active:translate-y-1 active:border-0 disabled:pointer-events-none disabled:opacity-40"
        >
          <MaterialIcon name="download" className="text-lg text-[#58B13E]" />
          Download transcript (PDF)
        </button>
      </section>

    </div>
  );
}
