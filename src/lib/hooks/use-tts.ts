"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TtsState = "idle" | "loading" | "playing" | "error";

export type TtsOptions = {
  /** Override the default voice ID. */
  voice_id?: string;
  /** Speech rate: 0.5 – 2.0 (default 1.0). */
  speed?: number;
};

/**
 * React hook for Text-to-Speech via the Minimax Speech-01-Turbo API.
 *
 * @example
 * const { speak, stop, isPlaying, isLoading, error } = useTts();
 * await speak("Hello, this is a test.");
 * speak("Faster voice", { speed: 1.3 });
 */
export function useTts() {
  const [state, setState] = useState<TtsState>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stop any current playback and release resources. */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setState("idle");
    setError(null);
  }, []);

  /**
   * Send text to the TTS API and play the returned audio.
   * Returns a promise that resolves when playback finishes or rejects on error.
   * Does NOT throw if the browser blocks auto-play — sets error state and resolves.
   */
  const speak = useCallback(
    async (text: string, options?: TtsOptions): Promise<void> => {
      if (!text.trim()) return;

      // Stop any current playback first
      stop();

      if (!mountedRef.current) return;

      setState("loading");
      setError(null);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            voice_id: options?.voice_id,
            speed: options?.speed,
          }),
        });

        if (!res.ok) {
          let errMsg = `TTS request failed (${res.status})`;
          try {
            const errData = (await res.json()) as { error?: string };
            if (errData.error) errMsg = errData.error;
          } catch {
            // ignore parse error
          }
          throw new Error(errMsg);
        }

        const blob = await res.blob();
        if (!mountedRef.current) return;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        return new Promise<void>((resolve) => {
          audio.onended = () => {
            if (mountedRef.current) setState("idle");
            resolve();
          };

          audio.onerror = () => {
            if (mountedRef.current) {
              setState("error");
              setError("Audio playback failed.");
            }
            resolve(); // resolve rather than reject so callers don't need try/catch on auto-play
          };

          audio.oncanplay = () => {
            if (!mountedRef.current) return;
            setState("playing");
            audio.play().catch((playErr: Error) => {
              // Browser blocked auto-play (e.g. no user gesture yet).
              console.warn("[TTS] Auto-play blocked:", playErr.message);
              if (mountedRef.current) {
                setState("idle");
                setError(null);
              }
              resolve(); // Graceful — user can click replay button
            });
          };
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setState("error");
        setError(err instanceof Error ? err.message : "TTS failed.");
      }
    },
    [stop],
  );

  return {
    /** Send text to TTS and play. Await resolves when playback finishes. */
    speak,
    /** Stop current playback. */
    stop,
    /** Current state: idle | loading | playing | error. */
    state,
    /** Human-readable error message, null when no error. */
    error,
    /** Convenience: true while audio is playing. */
    isPlaying: state === "playing",
    /** Convenience: true while fetching audio from API. */
    isLoading: state === "loading",
  } as const;
}
