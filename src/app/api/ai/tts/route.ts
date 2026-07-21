import { NextResponse } from "next/server";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

type TtsBody = {
  text?: unknown;
  voiceId?: unknown;
};

const DEFAULT_VOICE_ID = "English_Persuasive_Man";

// Model preference order
const PREFERRED_MODELS = [
  "speech-01-turbo",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsBody;
    const text =
      typeof body.text === "string" && body.text.trim().length > 0
        ? body.text.trim()
        : null;
    const voiceId =
      typeof body.voiceId === "string" && body.voiceId.trim().length > 0
        ? body.voiceId.trim()
        : DEFAULT_VOICE_ID;

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Text is required." },
        { status: 400 },
      );
    }

    if (text.length > 10_000) {
      return NextResponse.json(
        { ok: false, error: "Text exceeds 10,000 character limit." },
        { status: 400 },
      );
    }

    const apiKey = required("MINIMAX_API_KEY");

    // Try models in preference order; fall through on 4xx/5xx
    let lastError: { status: number; body: string } | null = null;

    for (const model of PREFERRED_MODELS) {
      const minimaxRes = await fetch(
        "https://api.minimaxi.com/v1/t2a_v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            text,
            voice_setting: {
              voice_id: voiceId,
              speed: 1.0,
              vol: 1.0,
            },
            audio_setting: {
              format: "mp3",
              sample_rate: 32000,
            },
            output_format: "url",
          }),
        },
      );

      if (minimaxRes.ok) {
        const json = (await minimaxRes.json()) as {
          data?: { audio?: string };
          base_resp?: { status_code: number; status_msg?: string };
        };

        if (
          json.base_resp?.status_code === 0 &&
          typeof json.data?.audio === "string" &&
          json.data.audio.length > 0
        ) {
          // Fetch the audio blob from the returned URL
          const audioRes = await fetch(json.data.audio);
          if (!audioRes.ok) {
            return NextResponse.json(
              { ok: false, error: "Failed to fetch audio from MiniMax." },
              { status: 502 },
            );
          }

          const audioBuffer = await audioRes.arrayBuffer();

          return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": audioBuffer.byteLength.toString(),
              "Cache-Control": "private, no-cache",
            },
          });
        }

        // Model responded but no audio — try next
        lastError = {
          status: 200,
          body: JSON.stringify(json),
        };
        continue;
      }

      // Non-OK response — store and try next model
      const errorBody = await minimaxRes.text();
      lastError = { status: minimaxRes.status, body: errorBody };

      // Only retry on server errors (5xx) or model-not-found (not 4xx auth/rate-limit)
      if (minimaxRes.status < 500 && minimaxRes.status !== 404) {
        break;
      }
    }

    // All models exhausted
    console.error(
      "MiniMax TTS error:",
      lastError?.status,
      lastError?.body,
    );
    return NextResponse.json(
      {
        ok: false,
        error: lastError
          ? `MiniMax API error (${lastError.status})`
          : "All TTS models unavailable.",
      },
      { status: lastError?.status ?? 502 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to synthesize speech.";
    console.error("TTS route failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
