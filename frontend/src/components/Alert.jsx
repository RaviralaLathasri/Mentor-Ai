import { motion } from "framer-motion";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

const Alert = ({ type = "info", message, onClose }) => {
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
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-start justify-between gap-3 p-4 border rounded-xl text-sm transition-saas ${style.bg}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
        <span className="leading-relaxed font-normal">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-black/5 rounded-lg text-current/60 hover:text-current transition-saas shrink-0"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

export default Alert;