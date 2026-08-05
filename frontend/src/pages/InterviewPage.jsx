import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Settings, Mic, Volume2, Award, Sparkles, RefreshCw } from "lucide-react";

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
  const [connecting, setConnecting] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState("");

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

  const refreshMicDevices = async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = (devices || []).filter((d) => d.kind === "audioinput");
      setMicDevices(
        inputs.map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        })),
      );
    } catch {
      // ignore
    }
  };

  const startInterview = async () => {
    if (connecting || connected) return;
    setNotice({ type: "info", message: "" });
    setLastEvaluation(null);
    setFinalReport(null);
    setTranscript("");
    setQuestion("");
    setQuestionIndex(0);
    setTotalQuestions(0);
    setTtsEnabled(false);
    setSttEnabled(false);
    setConnecting(true);

    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const isCurrent = () => wsRef.current === ws;

    ws.onopen = () => {
      if (!isCurrent()) {
        try {
          ws.close();
        } catch {
          // ignore
        }
        return;
      }
      setConnected(true);
      setConnecting(false);
      refreshMicDevices();
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
      if (!isCurrent()) return;
      setConnected(false);
      setConnecting(false);
      setListening(false);
      setAiSpeaking(false);
      wsRef.current = null;
      
      const code = event?.code || 0;
      if (code && code !== 1000) {
        const reason = event?.reason ? ` (${event.reason})` : "";
        setNotice((prev) => {
          if (prev?.type === "error" && prev?.message) return prev;
          return { type: "error", message: `WebSocket closed (code ${code})${reason}. Check backend configuration.` };
        });
      }
    };

    ws.onerror = () => {
      if (!isCurrent()) return;
      setConnecting(false);
      setNotice({ type: "error", message: "WebSocket connection error. Check backend server status." });
    };

    ws.onmessage = (event) => {
      if (!isCurrent()) return;
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
          
          if (!msg.tts_url) {
            setAiSpeaking(false);
            setListening(true);
          } else {
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
    setConnecting(false);
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
    setTimeout(() => refreshMicDevices(), 500);
  };

  const muteMic = () => {
    setListening(false);
  };

  useEffect(() => {
    refreshMicDevices();
    return () => stopInterview();
  }, []);

  const fullTtsUrl = joinUrl(API_BASE_URL, ttsUrl);

  return (
    <PageShell
      title="Audio Mock Interview"
      subtitle="Complete live speech-to-text interviews: hear questions read aloud, speak your answer naturally, and check scores."
    >
      <StudentBanner
        studentId={studentId}
        onClear={() => {
          setStudentId(null);
          stopInterview();
        }}
      />
      <Notice type={notice.type} message={notice.message} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Setup Column */}
        <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-border/40">
            <Settings className="w-4 h-4 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-textPrimary font-heading">Interview Setup</h3>
          </div>

          <div className="space-y-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Target Role
              <select value={role} onChange={(e) => setRole(e.target.value)} disabled={connected}>
                <option>Data Analyst</option>
                <option>AI Engineer</option>
                <option>Web Developer</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Complexity Level
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={connected}>
                <option>Beginner</option>
                <option>Medium</option>
                <option>Advanced</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Total Questions
              <input
                type="number"
                min={1}
                max={10}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                disabled={connected}
              />
            </label>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {!connected ? (
              <button
                className="btn-primary w-full py-2.5"
                onClick={startInterview}
                disabled={!studentId || connecting}
              >
                <Play className="w-4 h-4" />
                <span>{connecting ? "Starting..." : "Start Interview"}</span>
              </button>
            ) : (
              <>
                <button
                  className="btn-primary w-full py-2.5"
                  onClick={submitAnswer}
                  disabled={aiSpeaking}
                >
                  Submit Current Answer
                </button>
                <button
                  className="btn-secondary w-full py-2.5 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                  onClick={stopInterview}
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>End Interview</span>
                </button>
              </>
            )}
          </div>
          
          {connected && (
            <p className="text-[10px] text-brand-textMuted leading-relaxed">
              When finished speaking, click <strong>Submit Current Answer</strong> to request evaluation and progress to the next prompt.
            </p>
          )}
        </section>

        {/* Dynamic Interview Interface */}
        <div className="lg:col-span-2 space-y-6">
          {connected ? (
            <>
              {/* Progress Tracker */}
              <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
                <div className="flex justify-between items-center text-xs text-brand-textSecondary font-semibold">
                  <span className="truncate">Session: <strong className="text-brand-textPrimary font-bold">{sessionId || "Initializing..."}</strong></span>
                  <span className="shrink-0">Question: <strong className="text-brand-primary font-bold">{questionIndex}</strong> of {totalQuestions}</span>
                </div>
                
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all duration-300"
                    style={{
                      width: totalQuestions ? `${Math.min(100, (questionIndex / totalQuestions) * 100)}%` : "0%",
                    }}
                  />
                </div>

                <div className="flex items-center gap-4 text-[10px] text-brand-textSecondary uppercase font-bold tracking-wider pt-1">
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${aiSpeaking ? 'bg-status-info animate-pulse' : 'bg-slate-300'}`}></span>
                    AI Speaking: {aiSpeaking ? "Yes" : "No"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${listening ? 'bg-status-success animate-pulse' : 'bg-slate-300'}`}></span>
                    Mic Listening: {listening ? "Yes" : "No"}
                  </span>
                </div>
              </section>

              {/* Current Question */}
              <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
                <h3 className="text-sm font-bold text-brand-textPrimary font-heading flex items-center gap-1.5 pb-2 border-b border-brand-border/40">
                  <Volume2 className="w-4.5 h-4.5 text-brand-primary" />
                  <span>Current Question Prompts</span>
                </h3>
                <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-xl">
                  <p className="text-sm font-medium text-brand-textPrimary leading-relaxed">
                    {question || "Generating question... please listen carefully."}
                  </p>
                </div>
                
                <QuestionPlayer
                  audioUrl={fullTtsUrl}
                  onSpeakingChange={(val) => {
                    setAiSpeaking(val);
                    setListening(!val);
                  }}
                />
              </section>

              {/* Live Transcript */}
              <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
                <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                  Live Response Transcription
                </h3>
                <LiveTranscript text={transcript} sttEnabled={sttEnabled} listening={listening} />
              </section>

              {/* Mic Controls */}
              <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-5">
                <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                  Microphone & Hardware Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                    Select Input Device
                    <div className="flex gap-2">
                      <select
                        value={micDeviceId}
                        onChange={(e) => setMicDeviceId(e.target.value)}
                        disabled={!connected || listening}
                        className="flex-1"
                      >
                        <option value="">Default System Microphone</option>
                        {(micDevices || []).map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-secondary py-2"
                        onClick={refreshMicDevices}
                        disabled={!connected}
                        title="Scan inputs"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </label>

                  <div className="flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      {!listening ? (
                        <button
                          type="button"
                          className="btn-primary py-2.5 px-6 shrink-0"
                          onClick={startMic}
                          disabled={!connected || aiSpeaking || !sttEnabled}
                        >
                          <Mic className="w-4 h-4" />
                          <span>Activate Mic</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary py-2.5 px-6 shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={muteMic}
                          disabled={!connected}
                        >
                          <span>Mute Microphone</span>
                        </button>
                      )}
                      <span className="text-[10px] text-brand-textMuted leading-snug">
                        Activate mic when AI stops speaking. Audio is transcribed in-memory.
                      </span>
                    </div>
                  </div>
                </div>

                <AudioRecorder
                  wsRef={wsRef}
                  enabled={connected && listening && !aiSpeaking}
                  deviceId={micDeviceId}
                  onError={(message) => setNotice({ type: "error", message })}
                />
              </section>

              {/* Evaluation scorecards */}
              {lastEvaluation && (
                <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
                  <h3 className="text-sm font-bold text-brand-textPrimary font-heading flex items-center gap-1.5 pb-2 border-b border-brand-border/40">
                    <Award className="w-4.5 h-4.5 text-brand-primary" />
                    <span>Answer Evaluation Breakdown</span>
                  </h3>
                  <div className="space-y-4 text-xs leading-relaxed">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-brand-textSecondary">Score:</span>
                      <span className="text-lg font-bold text-brand-primary">{lastEvaluation.evaluation?.score} / 10</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 bg-slate-50 border border-brand-border rounded-xl">
                        <span className="font-semibold text-brand-accent block mb-1">Answer Strengths</span>
                        <p className="text-brand-textSecondary leading-normal">
                          {(lastEvaluation.evaluation?.strengths || []).join(" | ") || "No distinct strengths highlighted."}
                        </p>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-brand-border rounded-xl">
                        <span className="font-semibold text-status-danger block mb-1">Answer Weaknesses</span>
                        <p className="text-brand-textSecondary leading-normal">
                          {(lastEvaluation.evaluation?.weaknesses || []).join(" | ") || "No distinct gaps highlighted."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-brand-primaryLight/40 border border-brand-primary/10 rounded-xl">
                      <span className="font-semibold text-brand-primary block mb-1">Socratic Coaching Tips</span>
                      <p className="text-brand-textSecondary leading-normal">
                        {(lastEvaluation.evaluation?.suggestions || []).join(" | ") || "Continue response practice."}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Final Report */}
              {finalReport && (
                <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
                  <h3 className="text-base font-bold text-brand-textPrimary font-heading flex items-center gap-1.5 pb-2 border-b border-brand-border/40">
                    <Sparkles className="w-5 h-5 text-brand-primary animate-pulse" />
                    <span>Final Cumulative Report</span>
                  </h3>
                  <InterviewReport report={finalReport} />
                </section>
              )}
            </>
          ) : (
            <section className="bg-slate-50 border border-dashed border-brand-border rounded-2xl p-16 text-center text-brand-textMuted py-32 space-y-2">
              <Mic className="w-12 h-12 text-brand-textMuted/45 mx-auto animate-pulse" />
              <h4 className="text-base font-bold uppercase tracking-wider text-brand-textSecondary">Awaiting Setup Completion</h4>
              <p className="text-xs text-brand-textSecondary max-w-sm mx-auto leading-relaxed">
                Choose your role, level, and question count targets on the left panel, then click <strong>Start Interview</strong> to run your live WebSocket session.
              </p>
            </section>
          )}
        </div>

      </div>
    </PageShell>
  );
}
