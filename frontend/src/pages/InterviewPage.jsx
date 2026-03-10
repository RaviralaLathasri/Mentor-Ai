import { useEffect, useMemo, useRef, useState } from "react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import AudioRecorder from "../components/interview/AudioRecorder";
import InterviewReport from "../components/interview/InterviewReport";
import LiveTranscript from "../components/interview/LiveTranscript";
import QuestionPlayer from "../components/interview/QuestionPlayer";
import useStudentId from "../hooks/useStudentId";
import { API_BASE_URL, wsBaseUrl } from "../services/api";

function joinUrl(base, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const b = (base || "").replace(/\/+$/, "");
  const p = String(path).startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export default function InterviewPage() {
  const [studentId, setStudentId] = useStudentId();
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const [role, setRole] = useState("Data Analyst");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [questionCount, setQuestionCount] = useState(5);

  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [ttsUrl, setTtsUrl] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);

  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  const wsRef = useRef(null);

  const wsUrl = useMemo(() => `${wsBaseUrl()}/api/audio-interview/ws`, []);

  const startInterview = async () => {
    setNotice({ type: "info", message: "" });
    setLastEvaluation(null);
    setFinalReport(null);
    setTranscript("");
    setQuestion("");
    setQuestionIndex(0);
    setTotalQuestions(0);
    setTtsEnabled(false);
    setSttEnabled(false);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: "start",
          student_id: studentId ? Number(studentId) : 0,
          role,
          difficulty,
          question_count: Number(questionCount) || 5,
        }),
      );
    };

    ws.onclose = (event) => {
      setConnected(false);
      setListening(false);
      setAiSpeaking(false);
      // If the socket closes unexpectedly, surface it (common cause: missing Redis).
      // Note: `onerror` isn't guaranteed to fire for all close scenarios.
      const code = event?.code || 0;
      if (code && code !== 1000) {
        const reason = event?.reason ? ` (${event.reason})` : "";
        setNotice((prev) => {
          if (prev?.type === "error" && prev?.message) return prev;
          return { type: "error", message: `WebSocket closed (code ${code})${reason}. Check backend logs and Redis configuration.` };
        });
      }
    };

    ws.onerror = () => {
      setNotice({ type: "error", message: "WebSocket error. Check backend is running and reachable." });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "session_started") {
          setSessionId(msg.session_id);
          setTotalQuestions(msg.total_questions || 0);
          setTtsEnabled(Boolean(msg.tts_enabled));
          setSttEnabled(Boolean(msg.stt_enabled));
          const warnings = Array.isArray(msg.warnings) ? msg.warnings.filter(Boolean) : [];
          if (warnings.length) {
            setNotice({ type: "warning", message: warnings.join(" ") });
          } else if (msg.stt_enabled === false) {
            setNotice({ type: "warning", message: "STT is not configured. Set GROQ_API_KEY to enable live transcription." });
          }
          return;
        }
        if (msg.type === "question") {
          setQuestion(msg.question || "");
          setQuestionIndex(msg.question_index || 0);
          setTotalQuestions(msg.total_questions || 0);
          setTtsUrl(msg.tts_url || "");
          setTranscript("");
          setLastEvaluation(null);
          setFinalReport(null);
          // If TTS isn't enabled/configured, there is no audio to play. Turn on listening so the student can answer.
          if (!msg.tts_url) {
            setAiSpeaking(false);
            setListening(true);
          } else {
            // Wait for the audio player to flip listening state (on end / autoplay fallback).
            setListening(false);
          }
          return;
        }
        if (msg.type === "transcript") {
          if (msg.text) {
            setTranscript((prev) => (prev ? `${prev} ${msg.text}` : msg.text));
          }
          if (msg.final) {
            setListening(false);
          }
          return;
        }
        if (msg.type === "evaluation") {
          setLastEvaluation(msg);
          return;
        }
        if (msg.type === "final_report") {
          setFinalReport(msg.report || null);
          setListening(false);
          return;
        }
        if (msg.type === "error") {
          setNotice({ type: "error", message: msg.message || "Interview error" });
          return;
        }
      } catch (e) {
        setNotice({ type: "error", message: "Bad message from server." });
      }
    };
  };

  const stopInterview = () => {
    const ws = wsRef.current;
    try {
      ws?.send(JSON.stringify({ type: "end" }));
      ws?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
    setConnected(false);
    setListening(false);
    setAiSpeaking(false);
  };

  const submitAnswer = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setListening(false);
    ws.send(JSON.stringify({ type: "stop_answer" }));
  };

  const startMic = () => {
    if (!connected) return;
    setAiSpeaking(false);
    setListening(true);
  };

  const muteMic = () => {
    setListening(false);
  };

  useEffect(() => {
    return () => stopInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fullTtsUrl = joinUrl(API_BASE_URL, ttsUrl);

  return (
    <PageShell
      title="Audio Interview"
      subtitle="Live audio-only interview with AI: TTS questions, real-time STT transcript, and structured feedback. No audio files are stored."
    >
      <StudentBanner
        studentId={studentId}
        onClear={() => {
          setStudentId(null);
          stopInterview();
        }}
      />
      <Notice type={notice.type} message={notice.message} />

      <section className="panel form-grid">
        <h3>Interview Setup</h3>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={connected}>
            <option>Data Analyst</option>
            <option>AI Engineer</option>
            <option>Web Developer</option>
          </select>
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={connected}>
            <option>Beginner</option>
            <option>Medium</option>
            <option>Advanced</option>
          </select>
        </label>
        <label>
          Questions
          <input
            type="number"
            min={1}
            max={10}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            disabled={connected}
          />
        </label>

        <div className="button-row full-width">
          {!connected ? (
            <button className="primary-btn" onClick={startInterview} disabled={!studentId}>
              Start Interview
            </button>
          ) : (
            <>
              <button className="primary-btn" onClick={submitAnswer} disabled={aiSpeaking}>
                Submit Answer
              </button>
              <button className="secondary-btn" onClick={stopInterview}>
                End Interview
              </button>
            </>
          )}
        </div>
        <small>
          Backend: {API_BASE_URL || "(relative)"}. WebSocket: {wsUrl}.
        </small>
      </section>

      {connected ? (
        <>
          <section className="panel">
            <h3>Progress</h3>
            <p>
              <strong>Session:</strong> {sessionId || "starting..."}
            </p>
            <p>
              <strong>Question:</strong> {questionIndex || 0} / {totalQuestions || 0}
            </p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: totalQuestions ? `${Math.min(100, (questionIndex / totalQuestions) * 100)}%` : "0%",
                }}
              />
            </div>
            <p>
              <strong>AI speaking:</strong> {aiSpeaking ? "Yes" : "No"} | <strong>Listening:</strong>{" "}
              {listening ? "Yes" : "No"}
            </p>
          </section>

          <section className="panel">
            <h3>Current Question</h3>
            <p>{question || "Waiting for question..."}</p>
            <QuestionPlayer
              audioUrl={fullTtsUrl}
              onSpeakingChange={(value) => {
                setAiSpeaking(value);
                setListening(!value);
              }}
            />
          </section>

          <section className="panel">
            <h3>Live Transcript</h3>
            <LiveTranscript text={transcript} />
          </section>

          <section className="panel">
            <h3>Microphone</h3>
            <div className="button-row" style={{ marginBottom: 10 }}>
              {!listening ? (
                <button className="primary-btn" onClick={startMic} disabled={!connected || aiSpeaking}>
                  Start Mic
                </button>
              ) : (
                <button className="ghost-btn" onClick={muteMic} disabled={!connected}>
                  Mute Mic
                </button>
              )}
              <small style={{ alignSelf: "center", color: "var(--muted)" }}>
                Speak when <strong>Listening</strong> is <strong>Yes</strong>.
              </small>
            </div>
            <AudioRecorder
              wsRef={wsRef}
              enabled={connected && listening && !aiSpeaking}
              onError={(message) => setNotice({ type: "error", message })}
            />
            <small>Audio is streamed to backend as in-memory PCM and discarded after transcription.</small>
          </section>

          {lastEvaluation ? (
            <section className="panel">
              <h3>Answer Evaluation</h3>
              <p>
                <strong>Score:</strong> {lastEvaluation.evaluation?.score} / 10
              </p>
              <p>
                <strong>Strengths:</strong> {(lastEvaluation.evaluation?.strengths || []).join(" | ") || "n/a"}
              </p>
              <p>
                <strong>Weaknesses:</strong> {(lastEvaluation.evaluation?.weaknesses || []).join(" | ") || "n/a"}
              </p>
              <p>
                <strong>Suggestions:</strong> {(lastEvaluation.evaluation?.suggestions || []).join(" | ") || "n/a"}
              </p>
            </section>
          ) : null}

          {finalReport ? (
            <section className="panel">
              <h3>Final Interview Report</h3>
              <InterviewReport report={finalReport} />
            </section>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
