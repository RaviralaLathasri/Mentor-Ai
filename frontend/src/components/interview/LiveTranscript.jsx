import { Sparkles, MessageSquare } from "lucide-react";

export default function LiveTranscript({ text, sttEnabled = true, listening = false }) {
  if (!sttEnabled) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs leading-relaxed" aria-live="polite">
        <p className="font-semibold mb-1">Live Transcription Disabled</p>
        <p className="text-amber-800">
          Speech-to-Text is not enabled. Set the <code>GROQ_API_KEY</code> variable in the backend and restart server.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-2xl min-h-[80px] flex gap-3 items-start" aria-live="polite">
      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
        <MessageSquare className="w-4 h-4" />
      </div>
      <div className="text-xs leading-relaxed flex-1 pt-1.5">
        {text ? (
          <p className="text-brand-textPrimary font-medium font-heading">{text}</p>
        ) : (
          <p className="text-brand-textMuted italic">
            {listening ? "Listening for speech... start speaking now." : "Awaiting microphone input..."}
          </p>
        )}
      </div>
    </div>
  );
}
