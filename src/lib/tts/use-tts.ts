"use client";

import { useRef, useState, useCallback } from "react";

export type TtsStatus = "idle" | "loading" | "playing" | "error";

export function useTts() {
  const [status, setStatus] = useState<TtsStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  /** Speak the given text. Stops any currently playing utterance. */
  const speak = useCallback(async (text: string) => {
    // Tear down any previous playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!text.trim()) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? `TTS request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setStatus("idle");
          resolve();
        };
        audio.onerror = () => {
          setStatus("error");
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch(reject);
      });

      setStatus("playing");

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        const check = () => {
          if (audio.ended || audio.paused) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        audio.onended = () => resolve();
        check();
      });

      setStatus("idle");
    } catch (err) {
      console.warn("TTS speak error:", err);
      setStatus("error");
    } finally {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current = null;
    }
  }, []);

  /** Stop current playback immediately. */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setStatus("idle");
  }, []);

  return { status, speak, stop } as const;
}
