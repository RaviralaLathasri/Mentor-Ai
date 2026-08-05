import { motion } from "framer-motion";

export default function PageShell({ title, subtitle, children, actions }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-brand-border">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-textPrimary font-heading">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm md:text-base text-brand-textSecondary font-normal max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </motion.main>
  );
}
