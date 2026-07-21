"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type SttStatus = "idle" | "recording" | "processing" | "error";

export interface UseSttReturn {
  status: SttStatus;
  error: string | null;
  transcribedText: string | null;
  /** Elapsed recording time in milliseconds. */
  elapsedMs: number;
  /** Normalised input volume 0–1 (useful for a level meter). */
  volume: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  reset: () => void;
}

const MAX_DURATION_MS = 30_000; // 30-second Zhipu limit

/* ---- WAV encoder ------------------------------------------------------ */

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const bufferSize = 44 + dataSize;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  const w = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  w(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  w(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

/* ---- Hook --------------------------------------------------------------- */

export function useStt(): UseSttReturn {
  const [status, setStatus] = useState<SttStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [volume, setVolume] = useState(0);

  const statusRef = useRef<SttStatus>("idle");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);

  const setStatusBoth = useCallback((s: SttStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  /* ---- Clean-up on unmount ------------------------------------------- */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  /* ---- Start --------------------------------------------------------- */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscribedText(null);
      setElapsedMs(0);
      setVolume(0);
      samplesRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        samplesRef.current.push(new Float32Array(input));

        // Volume level for visual feedback
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += Math.abs(input[i]);
        setVolume(Math.min(1, (sum / input.length) * 10));
      };

      // Muted gain node completes the audio graph so onaudioprocess fires,
      // without playing audio back through speakers (avoids feedback).
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      setStatusBoth("recording");
      startTimeRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);

      // Auto-stop at 30 s
      maxDurationTimerRef.current = window.setTimeout(() => {
        if (statusRef.current === "recording") {
          void stopRecordingInternal();
        }
      }, MAX_DURATION_MS);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied. Allow microphone permissions and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not start recording.");
      }
      setStatusBoth("error");
    }
  }, []);

  /* ---- Stop (internal – no closure on status) ----------------------- */
  const stopRecordingInternal = useCallback(async () => {
    if (statusRef.current !== "recording") return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    maxDurationTimerRef.current = null;
    setVolume(0);

    // Tear down Web Audio graph
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
    } catch {
      /* best effort */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    setStatusBoth("processing");

    try {
      const ctx = audioCtxRef.current;
      if (!ctx) throw new Error("Audio context lost.");
      const sampleRate = ctx.sampleRate;
      await ctx.close();

      // Merge interleaved samples
      const totalLen = samplesRef.current.reduce((s, a) => s + a.length, 0);
      if (totalLen === 0) throw new Error("No audio captured.");
      const merged = new Float32Array(totalLen);
      let off = 0;
      for (const arr of samplesRef.current) {
        merged.set(arr, off);
        off += arr.length;
      }

      // Encode as WAV
      const wav = encodeWav(merged, sampleRate);
      const blob = new Blob([wav], { type: "audio/wav" });

      // Transcribe via our proxy
      const fd = new FormData();
      fd.append("audio", blob, "recording.wav");

      const res = await fetch("/api/ai/stt", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; text?: string; error?: string };

      if (data.ok && data.text) {
        setTranscribedText(data.text);
        setStatusBoth("idle");
      } else {
        setError(data.error ?? "Transcription failed.");
        setStatusBoth("error");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transcription request failed.");
      setStatusBoth("error");
    }
  }, []);

  /* ---- Stop (public) ------------------------------------------------- */
  const stopRecording = useCallback(async () => {
    await stopRecordingInternal();
  }, [stopRecordingInternal]);

  /* ---- Reset --------------------------------------------------------- */
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    setStatusBoth("idle");
    setError(null);
    setTranscribedText(null);
    setElapsedMs(0);
    setVolume(0);
  }, []);

  return {
    status,
    error,
    transcribedText,
    elapsedMs,
    volume,
    startRecording,
    stopRecording,
    reset,
  };
}
