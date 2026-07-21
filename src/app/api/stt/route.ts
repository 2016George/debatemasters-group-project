import { NextResponse } from "next/server";

const ZHIPU_STT_URL =
  "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error("[STT] ZHIPU_API_KEY is not configured");
      return NextResponse.json(
        { ok: false, error: "STT service is not configured." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { ok: false, error: "Missing 'audio' field in form data." },
        { status: 400 },
      );
    }

    if (audioFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Audio file exceeds the 25 MB size limit." },
        { status: 400 },
      );
    }

    const zhipuBody = new FormData();
    zhipuBody.append("file", audioFile);
    zhipuBody.append("model", "glm-asr-2512");

    const zhipuRes = await fetch(ZHIPU_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: zhipuBody,
    });

    if (!zhipuRes.ok) {
      const errorText = await zhipuRes.text();
      console.error(
        `[STT] Zhipu API error (${zhipuRes.status}):`,
        errorText.slice(0, 500),
      );
      return NextResponse.json(
        { ok: false, error: "Transcription service returned an error." },
        { status: 502 },
      );
    }

    const data = (await zhipuRes.json()) as {
      text?: string;
      id?: string;
      created?: number;
      model?: string;
    };

    const text = data.text?.trim();
    if (!text) {
      console.warn("[STT] Zhipu returned empty text:", JSON.stringify(data));
      return NextResponse.json(
        { ok: false, error: "Transcription returned empty text." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, text });
  } catch (error) {
    console.error("[STT] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
