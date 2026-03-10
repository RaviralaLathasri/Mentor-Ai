export default function LiveTranscript({ text, sttEnabled = true, listening = false }) {
  if (!sttEnabled) {
    return (
      <div className="transcript-box" aria-live="polite">
        <p className="muted">
          Transcription is disabled. Set <code>GROQ_API_KEY</code> in the backend <code>.env</code> and restart the backend.
        </p>
      </div>
    );
  }

  return (
    <div className="transcript-box" aria-live="polite">
      {text ? <p>{text}</p> : <p className="muted">{listening ? "Listening... speak now." : "Waiting for transcript..."}</p>}
    </div>
  );
}
