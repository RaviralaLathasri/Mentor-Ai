import { UserCheck, AlertCircle } from "lucide-react";

export default function StudentBanner({ studentId, onClear }) {
  if (!studentId) {
    return (
      <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>No active student profile loaded.</strong> Please create or load a student profile from the Profile page.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-brand-primaryLight border border-brand-primary/20 rounded-xl text-brand-primary text-sm shadow-sm">
      <div className="flex items-center gap-2.5">
        <UserCheck className="w-5 h-5 text-brand-primary shrink-0" />
        <span className="font-medium">
          Logged in as Student ID: <strong className="font-bold underline bg-white/60 px-1.5 py-0.5 rounded">{studentId}</strong>
        </span>
      </div>
      <button
        type="button"
        className="px-3 py-1 bg-white border border-brand-primary/20 hover:bg-brand-primary/10 hover:border-brand-primary/30 text-brand-primary font-semibold rounded-lg text-xs transition-saas shadow-xs"
        onClick={onClear}
      >
        Clear Context
      </button>
    </div>
  );
}
