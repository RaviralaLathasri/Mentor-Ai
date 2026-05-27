export default function StudentBanner({ studentId, onClear }) {
  if (!studentId) {
    return (
      <div className="student-banner warning">
        <strong>No active student.</strong> Create a profile to unlock adaptive mentoring.
      </div>
    );
  }

  return (
    <div className="student-banner">
      <div>
        Active Student ID: <strong>{studentId}</strong>
      </div>
      <button type="button" className="ghost-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
