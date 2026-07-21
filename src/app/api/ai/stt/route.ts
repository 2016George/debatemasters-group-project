import { NextResponse } from "next/server";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No audio file provided." },
        { status: 400 },
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Audio file exceeds 25 MB limit." },
        { status: 400 },
      );
    }

    const zhipuApiKey = required("ZHIPU_API_KEY");

    // Build multipart body for Zhipu
    const body = new FormData();
    body.set("model", "glm-asr-2512");
    body.set("stream", "false");
    body.set(
      "file",
      audioFile,
      audioFile.name.endsWith(".wav") || audioFile.name.endsWith(".mp3")
        ? audioFile.name
        : "audio.wav",
    );

    const res = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${zhipuApiKey}`,
        },
        body,
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Zhipu STT error:", res.status, errorBody);
      return NextResponse.json(
        { ok: false, error: `Zhipu API error: ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      text?: string;
      id?: string;
      request_id?: string;
    };

    if (!data.text || typeof data.text !== "string") {
      return NextResponse.json(
        { ok: false, error: "Empty transcription returned." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, text: data.text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transcribe audio.";
    console.error("STT route failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
