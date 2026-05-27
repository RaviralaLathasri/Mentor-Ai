export default function Notice({ type = "info", message }) {
  if (!message) return null;
  return <div className={`notice ${type}`}>{message}</div>;
}
