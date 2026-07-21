import { NextResponse } from "next/server";

const MINIMAX_TTS_URL = "https://api.minimaxi.com/v1/t2a_v2";

// Default Chinese voice (system voice from Minimax)
const DEFAULT_VOICE_ID = "moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      console.error("[TTS] MINIMAX_API_KEY is not configured");
      return NextResponse.json(
        { ok: false, error: "TTS service is not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      voice_id?: string;
      speed?: number;
    };

    const text = body.text;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing or empty 'text' field." },
        { status: 400 },
      );
    }

    const trimmed = text.trim();
    if (trimmed.length > 10000) {
      return NextResponse.json(
        { ok: false, error: "Text exceeds the 10,000 character limit." },
        { status: 400 },
      );
    }

    const minimaxRes = await fetch(MINIMAX_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "speech-01-turbo",
        text: trimmed,
        voice_setting: {
          voice_id: body.voice_id ?? DEFAULT_VOICE_ID,
          speed: body.speed ?? 1.0,
          vol: 1.0,
        },
        audio_setting: {
          format: "mp3",
          sample_rate: 32000,
          bitrate: 128000,
          channel: 1,
        },
      }),
    });

    if (!minimaxRes.ok) {
      const errorText = await minimaxRes.text();
      console.error(
        `[TTS] Minimax API error (${minimaxRes.status}):`,
        errorText.slice(0, 500),
      );
      return NextResponse.json(
        { ok: false, error: "TTS service returned an error." },
        { status: 502 },
      );
    }

    const data = (await minimaxRes.json()) as {
      data?: { audio?: string; status?: number };
      base_resp?: { status_code?: number; status_msg?: string };
      extra_info?: {
        audio_length?: number;
        audio_sample_rate?: number;
        audio_size?: number;
        bitrate?: number;
        audio_format?: string;
        usage_characters?: number;
      };
      trace_id?: string;
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      console.error(
        `[TTS] Minimax API error (${data.base_resp.status_code}):`,
        data.base_resp.status_msg,
      );
      return NextResponse.json(
        {
          ok: false,
          error: data.base_resp.status_msg ?? "TTS service error.",
          code: data.base_resp.status_code,
        },
        { status: 502 },
      );
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio || typeof hexAudio !== "string") {
      console.error("[TTS] Missing audio in response:", JSON.stringify(data));
      return NextResponse.json(
        { ok: false, error: "TTS returned no audio data." },
        { status: 500 },
      );
    }

    // Convert hex-encoded audio to binary
    const audioBuffer = Buffer.from(hexAudio, "hex");
    const extra = data.extra_info ?? {};

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "X-Audio-Length-Ms": (extra.audio_length ?? "").toString(),
        "X-Audio-Format": (extra.audio_format ?? "mp3").toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[TTS] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}

// Accept GET for preflight / CORS
export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST." }, { status: 405 });
}
