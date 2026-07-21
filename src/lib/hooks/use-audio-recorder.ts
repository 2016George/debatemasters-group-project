"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// WAV encoder — converts an AudioBuffer (decoded from webm/opus) into a WAV
// blob. Zhipu's STT API only accepts .wav or .mp3 files.
// ---------------------------------------------------------------------------
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  // OfflineAudioContext lets us decode without a live destination
  const audioCtx = new OfflineAudioContext(1, 1, 16000);
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Interleave all channels into one Float32 array
  const pcmData = new Float32Array(length * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      pcmData[i * numChannels + ch] = channelData[i];
    }
  }

  // Convert float32 [-1, 1] → int16 [-32768, 32767]
  const pcm16 = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const bytesPerSample = 2;
  const dataSize = pcm16.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM (uncompressed)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM data
  let offset = 44;
  for (let i = 0; i < pcm16.length; i++) {
    view.setInt16(offset, pcm16[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export type AudioRecorderStatus =
  | { type: "idle" }
  | { type: "recording" }
  | { type: "processing" }
  | { type: "error"; message: string }
  | { type: "permission-denied" }
  | { type: "not-supported" };

type UseAudioRecorderOptions = {
  onTranscription: (text: string) => void;
  maxDurationMs?: number;
};

export function useAudioRecorder({
  onTranscription,
  maxDurationMs = 30_000,
}: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<AudioRecorderStatus>({ type: "idle" });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptionRef = useRef(onTranscription);
  onTranscriptionRef.current = onTranscription;

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore stop errors during cleanup
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus({ type: "not-supported" });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      ) {
        setStatus({ type: "permission-denied" });
        return;
      }
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Could not access microphone.",
      });
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      setStatus({ type: "processing" });

      const blob = new Blob(chunksRef.current, {
        type: mimeType || recorder.mimeType,
      });
      chunksRef.current = [];
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      try {
        // Convert webm → wav because Zhipu only accepts .wav / .mp3
        const wavBlob = await blobToWav(blob);

        const formData = new FormData();
        formData.append("audio", wavBlob, "recording.wav");

        const res = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json()) as {
          ok?: boolean;
          text?: string;
          error?: string;
        };

        if (res.ok && data.ok && data.text) {
          onTranscriptionRef.current(data.text);
          setStatus({ type: "idle" });
        } else {
          setStatus({
            type: "error",
            message: data.error ?? "Transcription failed.",
          });
        }
      } catch (err) {
        setStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Network error during transcription.",
        });
      }
    };

    recorder.onerror = () => {
      setStatus({
        type: "error",
        message: "Recording error occurred.",
      });
      cleanup();
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
    setStatus({ type: "recording" });

    timeoutRef.current = setTimeout(() => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    }, maxDurationMs);
  }, [cleanup, maxDurationMs]);

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetStatus = useCallback(() => {
    setStatus({ type: "idle" });
  }, []);

  return { status, startRecording, stopRecording, resetStatus };
}
