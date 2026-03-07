import { useEffect, useMemo, useRef, useState } from "react";

import FeedbackButtons from "../components/FeedbackButtons";
import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { feedbackApi, mentorApi } from "../services/api";

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

    setMessages([
      {
        id: `welcome-${studentId}`,
        role: "assistant",
        text: "Start with a concept question. I will guide using Socratic prompts.",
      },
    ]);
  }, [studentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const sendMessage = async (event) => {
    event.preventDefault();
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
    <PageShell title="Mentor Chat Interface" subtitle="Ask questions and provide immediate feedback.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="panel">
          <p>Create or load a student profile first to start the mentor chat.</p>
        </section>
      ) : (
        <>
          <section className="panel chat-panel">
            {messages.map((message, index) => (
              <article key={message.id} className={`chat-bubble ${message.role}`}>
                <p>{message.text}</p>
                {message.role === "assistant" && message.followUp ? (
                  <p className="follow-up">Follow-up: {message.followUp}</p>
                ) : null}
                {message.role === "assistant" && message.responseId ? (
                  <div className="feedback-block">
                    <FeedbackButtons
                      selected={message.feedback}
                      disabled={Boolean(message.feedback)}
                      onSubmit={(type) => submitFeedback(index, type)}
                    />
                    <small>
                      {message.feedback
                        ? `Feedback submitted: ${message.feedback}`
                        : `Style: ${message.style} | Concept: ${message.concept}`}
                    </small>
                  </div>
                ) : null}
              </article>
            ))}
            <div ref={endRef} />
          </section>

          <form className="panel chat-input" onSubmit={sendMessage}>
            <label>
              Ask Mentor
              <textarea
                rows="3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: Why does gradient descent use the negative gradient?"
              />
            </label>
            <div className="button-row">
              <button type="submit" className="primary-btn" disabled={!canSend}>
                {sending ? "Thinking..." : "Send"}
              </button>
            </div>
          </form>
        </>
      )}
    </PageShell>
  );
}
