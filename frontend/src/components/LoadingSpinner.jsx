export default function LoadingSpinner({ size = 'medium', message = 'Loading...' }) {
  const sizeClasses = {
    small: "w-5 h-5 border-2",
    medium: "w-8 h-8 border-3",
    large: "w-12 h-12 border-4",
  };

  const currentSize = sizeClasses[size] || sizeClasses.medium;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div className={`animate-spin rounded-full border-brand-primary/20 border-t-brand-primary ${currentSize}`}></div>
      {message && (
        <p className="text-xs font-medium text-brand-textSecondary animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}