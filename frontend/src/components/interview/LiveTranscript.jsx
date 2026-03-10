export default function LiveTranscript({ text }) {
  return (
    <div className="transcript-box" aria-live="polite">
      {text ? <p>{text}</p> : <p className="muted">Waiting for transcript...</p>}
    </div>
  );
}

