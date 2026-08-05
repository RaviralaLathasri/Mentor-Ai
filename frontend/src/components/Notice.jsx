import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function Notice({ type = "info", message }) {
  if (!message) return null;

  const config = {
    info: {
      bg: "bg-blue-50 border-blue-200/80 text-blue-800",
      icon: Info,
      iconColor: "text-blue-500",
    },
    success: {
      bg: "bg-emerald-50 border-emerald-200/80 text-emerald-800",
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
    },
    warning: {
      bg: "bg-amber-50 border-amber-200/80 text-amber-800",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
    },
    error: {
      bg: "bg-red-50 border-red-200/80 text-red-800",
      icon: XCircle,
      iconColor: "text-red-500",
    },
  };

  const style = config[type] || config.info;
  const Icon = style.icon;

  return (
    <div className={`flex items-start gap-2.5 p-4 border rounded-xl text-sm transition-saas ${style.bg}`}>
      <Icon className={`w-5 h-5 shrink-0 ${style.iconColor}`} />
      <span className="leading-relaxed font-normal">{message}</span>
    </div>
  );
}
