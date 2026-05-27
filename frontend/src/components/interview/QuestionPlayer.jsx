import { useEffect, useRef } from "react";

export default function QuestionPlayer({ audioUrl, onSpeakingChange }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioUrl) return;

    let cancelled = false;

    const play = async () => {
      try {
        onSpeakingChange?.(true);
        audio.src = audioUrl;
        audio.load();
        await audio.play();
      } catch {
        // Autoplay can be blocked; fall back to user gesture.
        onSpeakingChange?.(false);
      }
    };

    play();

    const onEnded = () => {
      if (cancelled) return;
      onSpeakingChange?.(false);
    };
    const onPlay = () => {
      if (cancelled) return;
      onSpeakingChange?.(true);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);

    return () => {
      cancelled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      try {
        audio.pause();
      } catch {
        // ignore
      }
    };
  }, [audioUrl, onSpeakingChange]);

  return <audio ref={audioRef} preload="none" />;
}

