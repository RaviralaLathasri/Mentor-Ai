import { useEffect, useState } from "react";

const STORAGE_KEYS = ["mentor_student_id", "studentId"];

function readStoredStudentId() {
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

export default function useStudentId() {
  const [studentId, setStudentIdState] = useState(readStoredStudentId);

  useEffect(() => {
    const listener = () => setStudentIdState(readStoredStudentId());
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const setStudentId = (value) => {
    if (!value) {
      STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      setStudentIdState(null);
      return;
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
      localStorage.setItem("mentor_student_id", String(numeric));
      localStorage.setItem("studentId", String(numeric));
      setStudentIdState(numeric);
    }
  };

  return [studentId, setStudentId];
}
