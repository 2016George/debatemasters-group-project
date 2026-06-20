import type { AgeBand } from "@/lib/data/types";

/** Age-banded fallback topics used when AI generation is unavailable. */
export const AGE_BAND_FALLBACK_TOPICS: Record<AgeBand, readonly string[]> = {
  under10: [
    "having homework every school night",
    "wearing school uniforms",
    "keeping class pets in every classroom",
    "giving students more recess time",
    "using tablets in class every day",
    "allowing healthy snacks during lessons",
    "having a longer weekend and shorter school days",
    "learning coding in primary school",
    "planting more trees in school playgrounds",
    "making team sports required for all students",
  ],
  "10-14": [
    "banning smartphones during school hours",
    "replacing most tests with project work",
    "starting school later in the morning",
    "making media literacy a required subject",
    "requiring students to complete community service",
    "limiting social media use for users under 16",
    "providing free public transport for students",
    "making coding a core middle school subject",
    "banning fast fashion ads aimed at teens",
    "reducing homework to improve student wellbeing",
  ],
  "15-18": [
    "making voting mandatory at age 18",
    "replacing standardized tests in university admissions",
    "requiring AI disclosure labels on online content",
    "phasing out fossil fuel subsidies within ten years",
    "making internships a graduation requirement",
    "setting strict limits on targeted ads to minors",
    "requiring social media companies to verify user age",
    "prioritizing public transit over private car expansion",
    "making climate education mandatory across all high schools",
    "requiring schools to teach financial literacy as a core course",
  ],
  "18+": [
    "implementing universal basic income funded by wealth taxes",
    "mandating transparent AI audits for high-impact systems",
    "making voting compulsory in democratic elections",
    "adopting a four-day workweek as the default model",
    "taxing carbon-intensive products at the point of sale",
    "expanding nuclear energy to meet climate targets",
    "banning facial recognition in public surveillance",
    "requiring gig economy platforms to provide full worker benefits",
    "limiting political microtargeting in digital campaigns",
    "prioritizing housing-first policy over short-term shelter expansion",
  ],
};

function normalizeAgeBand(ageBand: AgeBand | undefined): AgeBand {
  return ageBand === "under10" ||
    ageBand === "10-14" ||
    ageBand === "15-18" ||
    ageBand === "18+"
    ? ageBand
    : "10-14";
}

/** Turn a plain topic line into a WSDA resolution (idempotent if already prefixed). */
export function formatWsdaResolution(rawTopic: string): string {
  const trimmed = rawTopic.trim();
  if (!trimmed) return "This house believes debate matters.";
  if (/^this house believes\b/i.test(trimmed)) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }

  if (trimmed.endsWith("?") && /^should\s+/i.test(trimmed)) {
    const rest = trimmed.slice(0, -1).replace(/^should\s+/i, "").trim();
    if (!/\bshould\b/i.test(rest)) {
      return `This house believes that ${rest} should be the case.`;
    }
    return `This house believes that ${rest}.`;
  }

  const body = trimmed.replace(/\?+$/, "").trim();
  return `This house believes ${body}.`;
}

function renderTopicForFormat(baseTopic: string, format: "wsda" | "free_form"): string {
  if (format === "wsda") {
    return formatWsdaResolution(baseTopic);
  }
  return `Should we support ${baseTopic}?`;
}

export function pickRandomMatchTopic(
  format: "wsda" | "free_form" = "wsda",
  ageBand?: AgeBand,
): string {
  const band = normalizeAgeBand(ageBand);
  const source = AGE_BAND_FALLBACK_TOPICS[band];
  const i = Math.floor(Math.random() * source.length);
  const picked = source[i] ?? source[0];
  return renderTopicForFormat(picked, format);
}
