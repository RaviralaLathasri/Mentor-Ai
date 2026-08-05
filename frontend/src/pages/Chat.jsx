import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, User, AlertCircle, RefreshCw } from "lucide-react";

import FeedbackButtons from "../components/FeedbackButtons";
import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { feedbackApi, mentorApi } from "../services/api";

const CHAT_STORAGE_PREFIX = "mentor_chat_messages_v1_";

function chatStorageKey(studentId) {
  return `${CHAT_STORAGE_PREFIX}${studentId}`;
}

function defaultWelcomeMessage(studentId) {
  return {
    id: `welcome-${studentId}`,
    role: "assistant",
    text: "Start with a concept question. I will guide you through our topics using Socratic prompts.",
  };
}

function loadStoredMessages(studentId) {
  if (!studentId) return [];
  const raw = localStorage.getItem(chatStorageKey(studentId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && item.role && item.text);
  } catch {
    return [];
  }
}

function storeMessages(studentId, messages) {
  if (!studentId) return;
  localStorage.setItem(chatStorageKey(studentId), JSON.stringify(messages));
}

export default function Chat() {
  const [studentId, setStudentId] = useStudentId();
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const endRef = useRef(null);

  useEffect(() => {
    if (!studentId) {
      setMessages([]);
      return;
    }

    const stored = loadStoredMessages(studentId);
    if (stored.length > 0) {
      setMessages(stored);
      return;
    }

    setMessages([defaultWelcomeMessage(studentId)]);
  }, [studentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!studentId) return;
    if (!messages.length) return;
    storeMessages(studentId, messages);
  }, [studentId, messages]);

  const canSend = useMemo(() => Boolean(studentId && query.trim() && !sending), [studentId, query, sending]);

  const clearStudent = () => {
    setStudentId(null);
    setNotice({ type: "info", message: "Student context cleared." });
  };

  const requestMentorResponse = async (payload, retries = 1) => {
    try {
      return await mentorApi.respond(payload);
    } catch (error) {
      const message = (error?.message || "").toLowerCase();
      const isTransient =
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("failed to fetch") ||
        message.includes("503") ||
        message.includes("502") ||
        message.includes("500");

      if (retries > 0 && isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return requestMentorResponse(payload, retries - 1);
      }
      throw error;
    }
  };

  const sendCurrentMessage = async () => {
    if (!canSend) return;

    const text = query.trim();
    setQuery("");

    setMessages((previous) => [...previous, { id: `u-${Date.now()}`, role: "user", text }]);
    setSending(true);

    try {
      const response = await requestMentorResponse({
        student_id: studentId,
        query: text,
      });

      setMessages((previous) => [
        ...previous,
        {
          id: `a-${response.response_id}`,
          role: "assistant",
          text: response.response,
          responseId: response.response_id,
          concept: response.target_concept,
          style: response.explanation_style,
          followUp: response.follow_up_question,
          feedback: "",
        },
      ]);
      setNotice({ type: "success", message: "Mentor response generated." });
    } catch (error) {
      const errorText = error?.message || "Could not generate mentor response.";
      setNotice({ type: "error", message: errorText });
      setMessages((previous) => [
        ...previous,
        {
          id: `a-error-${Date.now()}`,
          role: "assistant",
          text: `I could not reply due to a temporary issue: ${errorText}. Please press Send again.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    await sendCurrentMessage();
  };

  const handleTextareaKeyDown = async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendCurrentMessage();
    }
  };

  const submitFeedback = async (messageIndex, feedbackType) => {
    const message = messages[messageIndex];
    if (!message?.responseId || !studentId) return;

    try {
      await feedbackApi.submit({
        student_id: studentId,
        response_id: message.responseId,
        feedback_type: feedbackType,
        focus_concept: message.concept,
      });

      setMessages((previous) => {
        const copy = [...previous];
        copy[messageIndex] = { ...copy[messageIndex], feedback: feedbackType };
        return copy;
      });
      setNotice({ type: "success", message: `Feedback recorded as ${feedbackType}.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  return (
    <PageShell title="Mentor Chat" subtitle="Chat with your Socratic guide, answer prompts, and evaluate concept explanations.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="bg-white border border-brand-border rounded-2xl p-8 shadow-soft text-center space-y-4 max-w-md mx-auto mt-8">
          <AlertCircle className="w-12 h-12 text-amber-500/80 mx-auto" />
          <h3 className="text-lg font-bold text-brand-textPrimary font-heading">Student Context Required</h3>
          <p className="text-xs text-brand-textSecondary leading-relaxed">
            Please register or load a student profile from the Profile hub to start the conversational mentor chat.
          </p>
          <Link to="/profile" className="btn-primary inline-flex mt-2">
            Create Profile
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
          
          {/* Messages window */}
          <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft min-h-[400px] max-h-[500px] overflow-y-auto flex flex-col gap-6">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <article
                  key={message.id}
                  className={`flex gap-4 max-w-[85%] ${
                    isAssistant ? "self-start" : "self-end flex-row-reverse"
                  }`}
                >
                  {/* Icon Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      isAssistant
                        ? "bg-brand-primaryLight text-brand-primary"
                        : "bg-brand-secondary/10 text-brand-secondary"
                    }`}
                  >
                    {isAssistant ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Speech Bubble */}
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed border shadow-xs ${
                        isAssistant
                          ? "bg-brand-bgMain border-brand-border/60 text-brand-textPrimary"
                          : "bg-brand-primary text-white border-transparent"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      
                      {isAssistant && message.followUp && (
                        <div className="mt-3 pt-3 border-t border-brand-border/40 text-brand-primary font-medium text-xs">
                          <span>Follow-up:</span> <span className="font-semibold text-brand-textPrimary">{message.followUp}</span>
                        </div>
                      )}
                    </div>

                    {/* Socratic Feedback & Meta Data */}
                    {isAssistant && message.responseId && (
                      <div className="space-y-2 pl-1.5">
                        <div className="flex items-center gap-3">
                          <FeedbackButtons
                            selected={message.feedback}
                            disabled={Boolean(message.feedback)}
                            onSubmit={(type) => submitFeedback(index, type)}
                          />
                        </div>
                        <div className="text-[10px] text-brand-textMuted flex items-center gap-2">
                          {message.feedback ? (
                            <span className="font-semibold text-brand-primary bg-brand-primaryLight px-1.5 py-0.5 rounded">
                              Feedback: {message.feedback.replace("_", " ")}
                            </span>
                          ) : (
                            <>
                              <span>Style: <strong>{message.style}</strong></span>
                              <span>•</span>
                              <span>Target: <strong>{message.concept}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            
            {sending && (
              <div className="flex gap-4 max-w-[80%] self-start">
                <div className="w-9 h-9 rounded-full bg-brand-primaryLight text-brand-primary flex items-center justify-center animate-pulse shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-brand-bgMain border border-brand-border/60 text-brand-textSecondary px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking about Socratic adaptation...</span>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </section>

          {/* Form input area */}
          <form className="bg-white border border-brand-border rounded-2xl p-5 shadow-soft space-y-3" onSubmit={sendMessage}>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Ask Mentor
              <textarea
                rows="3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Example: Why does gradient descent use the negative gradient?"
                className="resize-none"
              />
            </label>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] text-brand-textMuted">
                Press <strong>Enter</strong> to send. Use <strong>Shift + Enter</strong> for a new line.
              </span>
              <button
                type="submit"
                className="btn-primary py-2 px-5 shrink-0"
                disabled={!canSend}
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

        </div>
      )}
    </PageShell>
  );
}
