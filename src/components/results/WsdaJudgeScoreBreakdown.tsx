"use client";

import type { WsdaSegmentScores, WsdaUserJudgeAssessment } from "@/lib/data/types";
import {
  WSDA_JUDGE_ASPECTS,
  WSDA_JUDGE_PERSUASIVENESS_MAX,
  WSDA_JUDGE_SEGMENTS,
  WSDA_JUDGE_SKILL_MAX,
  WSDA_JUDGE_TOTAL_MAX,
  type WsdaJudgeAspect,
  type WsdaJudgeSegment,
} from "@/lib/debate/wsda-transcript-segments";

const SEGMENT_LABELS: Record<WsdaJudgeSegment, string> = {
  constructive: "Constructive",
  crossExAttack: "Attack CX",
  crossExDefense: "Defense CX",
  rebuttal: "Rebuttal",
  finalFocus: "Final Focus",
};

const ASPECT_LABELS: Record<WsdaJudgeAspect, string> = {
  logic: "Logic",
  coherence: "Coherence",
  grammar: "Grammar",
  evidence: "Evidence",
  reactions: "Reactions",
  articulation: "Articulation",
};

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function segmentSubtotal(segment: WsdaSegmentScores): number {
  return WSDA_JUDGE_ASPECTS.reduce((sum, aspect) => sum + segment[aspect], 0);
}

export function WsdaJudgeScoreBreakdown({
  wsda,
}: {
  wsda: WsdaUserJudgeAssessment;
}) {
  return (
    <div className="mt-6 space-y-4 border-t border-stone-300 pt-6">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">
          WSDA judge scorecard
        </h3>
        <p className="mt-1 text-xs text-stone-600">
          Skill and persuasiveness from the doc rubric (human side only).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-2 border-stone-800 bg-stone-900 p-4 text-stone-100">
          <span className="block text-xs font-bold uppercase tracking-wide text-stone-400">
            Total
          </span>
          <span className="text-3xl font-extrabold tabular-nums">
            {formatScore(wsda.total)}
            <span className="ml-1 text-base font-bold text-stone-400">
              /{WSDA_JUDGE_TOTAL_MAX}
            </span>
          </span>
        </div>
        <div className="border-2 border-secondary bg-secondary-fixed-dim/40 p-4">
          <span className="block text-xs font-bold uppercase tracking-wide text-stone-800">
            Skill
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-stone-900">
            {formatScore(wsda.skillTotal)}
            <span className="ml-1 text-sm font-bold text-stone-700">
              /{WSDA_JUDGE_SKILL_MAX}
            </span>
          </span>
        </div>
        <div className="border-2 border-tertiary bg-tertiary-fixed-dim/40 p-4">
          <span className="block text-xs font-bold uppercase tracking-wide text-stone-800">
            Persuasiveness
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-stone-900">
            {formatScore(wsda.persuasivenessTotal)}
            <span className="ml-1 text-sm font-bold text-stone-700">
              /{WSDA_JUDGE_PERSUASIVENESS_MAX}
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-2 border-stone-300 bg-white">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-300 bg-stone-200/80 text-xs uppercase tracking-wide text-stone-800">
              <th className="px-3 py-2 font-bold">Segment</th>
              {WSDA_JUDGE_ASPECTS.map((aspect) => (
                <th key={aspect} className="px-2 py-2 text-center font-bold">
                  {ASPECT_LABELS[aspect]}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {WSDA_JUDGE_SEGMENTS.map((segmentKey) => {
              const row = wsda.segments[segmentKey];
              const subtotal = segmentSubtotal(row);
              return (
                <tr
                  key={segmentKey}
                  className="border-b border-stone-200 last:border-b-0"
                >
                  <td className="px-3 py-2 font-semibold text-stone-900">
                    {SEGMENT_LABELS[segmentKey]}
                  </td>
                  {WSDA_JUDGE_ASPECTS.map((aspect) => (
                    <td
                      key={aspect}
                      className="px-2 py-2 text-center tabular-nums text-stone-800"
                    >
                      {formatScore(row[aspect])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold tabular-nums text-stone-900">
                    {formatScore(subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
