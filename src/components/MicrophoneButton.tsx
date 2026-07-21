"use client";

import { useCallback, useRef } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";

type MicrophoneButtonProps = {
  onTranscription: (text: string) => void;
  disabled?: boolean;
};

export function MicrophoneButton({
  onTranscription,
  disabled = false,
}: MicrophoneButtonProps) {
  const { status, startRecording, stopRecording, resetStatus } =
    useAudioRecorder({ onTranscription });

  const isDisabled = disabled || status.type === "processing" || status.type === "not-supported";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isDisabled) return;
      void startRecording();
    },
    [isDisabled, startRecording],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (status.type === "recording") {
        stopRecording();
      }
    },
    [status.type, stopRecording],
  );

  const handleMouseLeave = useCallback(() => {
    if (status.type === "recording") {
      stopRecording();
    }
  }, [status.type, stopRecording]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDisabled) return;
      void startRecording();
    },
    [isDisabled, startRecording],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (status.type === "recording") {
        stopRecording();
      }
    },
    [status.type, stopRecording],
  );

  const handleTouchCancel = useCallback(() => {
    if (status.type === "recording") {
      stopRecording();
    }
  }, [status.type, stopRecording]);

  const handleClick = useCallback(() => {
    if (
      status.type === "error" ||
      status.type === "permission-denied"
    ) {
      resetStatus();
    }
  }, [status.type, resetStatus]);

  const baseButtonClass =
    "font-headline-pixel border-b-4 px-3 py-2 pixel-text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] transition-all enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed md:px-6 md:py-3";

  const { buttonClass, iconName, iconFilled, tooltip } = (() => {
    switch (status.type) {
      case "recording":
        return {
          buttonClass: `${baseButtonClass} border-red-800 bg-red-600 text-white animate-pulse`,
          iconName: "mic",
          iconFilled: true,
          tooltip: "Recording… release to transcribe",
        };
      case "processing":
        return {
          buttonClass: `${baseButtonClass} border-stone-700 bg-stone-700 text-stone-400`,
          iconName: "hourglass_top",
          iconFilled: false,
          tooltip: "Transcribing…",
        };
      case "error":
        return {
          buttonClass: `${baseButtonClass} border-yellow-800 bg-yellow-700 text-white`,
          iconName: "mic_off",
          iconFilled: false,
          tooltip: `Error: ${status.message}`,
        };
      case "permission-denied":
        return {
          buttonClass: `${baseButtonClass} border-yellow-800 bg-yellow-700 text-white`,
          iconName: "mic_off",
          iconFilled: false,
          tooltip: "Microphone access denied",
        };
      case "not-supported":
        return {
          buttonClass: `${baseButtonClass} border-stone-700 bg-stone-800 text-stone-500 opacity-50`,
          iconName: "mic_none",
          iconFilled: false,
          tooltip: "Voice recording not supported",
        };
      default: // idle
        return {
          buttonClass: `${baseButtonClass} border-orange-950 bg-orange-700 text-white enabled:hover:bg-orange-600`,
          iconName: "mic_none",
          iconFilled: false,
          tooltip: "Hold to record",
        };
    }
  })();

  return (
    <button
      type="button"
      className={buttonClass}
      disabled={isDisabled}
      title={tooltip}
      aria-label={tooltip}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
    >
      <MaterialIcon
        name={iconName}
        filled={iconFilled}
        className="text-lg leading-none md:text-xl"
      />
    </button>
  );
}
