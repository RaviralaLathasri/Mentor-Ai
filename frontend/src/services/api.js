import axios from "axios";

function normalizeBaseUrl(url) {
  if (!url) return url;
  // On some Windows setups, `localhost` resolves to IPv6 first and can hang if the backend
  // is only bound to 127.0.0.1. Normalize to IPv4 loopback for reliability.
  return url.replace("://localhost", "://127.0.0.1");
}

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL) || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

function parseError(error) {
  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    const healthUrl = `${API_BASE_URL.replace(/\/+$/, "")}/health`;
    return `Network Error: cannot reach backend API at ${API_BASE_URL}. Confirm the backend is running and that ${healthUrl} loads in your browser.`;
  }
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (typeof error?.response?.data === "string") {
    return error.response.data;
  }
  return error?.message || "Request failed";
}

async function request(promise) {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export const profileApi = {
  createStudent: (payload) => request(api.post("/api/profile/create", payload)),
  getStudent: (studentId) => request(api.get(`/api/profile/student/${studentId}`)),
  getProfile: (studentId) => request(api.get(`/api/profile/${studentId}`)),
  updateProfile: (studentId, payload) => request(api.put(`/api/profile/${studentId}`, payload)),
  upsertProfile: (studentId, payload) => request(api.post(`/api/profile/${studentId}/profile`, payload)),
};

export const mentorApi = {
  respond: (payload) => request(api.post("/api/mentor/respond", payload)),
};

export const feedbackApi = {
  submit: (payload) => request(api.post("/api/feedback/submit", payload)),
  rate: (payload) =>
    request(
      api.post("/api/feedback/rate-response", null, {
        params: payload,
      }),
    ),
};

export const wellnessApi = {
  submitQuiz: (payload) => request(api.post("/api/analyze/quiz", payload)),
  getQuizQuestion: (payload) =>
    request(
      api.get("/api/analyze/quiz-question", {
        params: payload,
      }),
    ),
  submitQuizAttempt: (payload) => request(api.post("/api/analyze/quiz-attempt", payload)),
  getWeakestConcepts: (studentId, limit = 8) =>
    request(api.get(`/api/analyze/weakest-concepts/${studentId}`, { params: { limit } })),
};

export const explainApi = {
  explainMistake: (payload) => request(api.post("/api/explain/mistake", payload)),
};

export const resumeApi = {
  analyze: (file, studentId) => {
    const formData = new FormData();
    formData.append("resume", file);
    if (studentId) {
      formData.append("student_id", String(studentId));
    }
    return request(
      api.post("/api/resume/analyze", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    );
  },
};

export const adaptiveApi = {
  createSession: (payload) => request(api.post("/api/adaptive/session", payload)),
  getStatus: (studentId) => request(api.get(`/api/adaptive/status/${studentId}`)),
  getRecommendations: (studentId) => request(api.get(`/api/adaptive/recommendations/${studentId}`)),
  generateStudyPlan: (payload) => request(api.post("/api/adaptive/study-plan", payload)),
};

export const analyticsApi = {
  getDashboard: (studentId) => request(api.get(`/api/analytics/dashboard/${studentId}`)),
  getFeedbackDistribution: (studentId) => request(api.get(`/api/analytics/feedback-distribution/${studentId}`)),
  getPerformanceOverTime: (studentId) => request(api.get(`/api/analytics/performance-over-time/${studentId}`)),
  getWeakestConcepts: (studentId, limit = 8) =>
    request(api.get(`/api/analytics/weakest-concepts/${studentId}`, { params: { limit } })),
  getWeaknessGraph: (studentId, limit = 8) =>
    request(api.get(`/api/analytics/weakest-concepts-graph/${studentId}`, { params: { limit } })),
  getSummary: (studentId) => request(api.get(`/api/analytics/summary/${studentId}`)),
};

export const careerApi = {
  generateRoadmap: (payload) => request(api.post("/api/career/roadmap/generate", payload)),
  getRoadmap: (role, params = {}) =>
    request(api.get(`/api/career/roadmap/${encodeURIComponent(role)}`, { params })),
};

export const interviewApi = {
  runMockInterview: (payload) => request(api.post("/api/interview/mock", payload)),
  getMockInterview: (sessionId) => request(api.get(`/api/interview/mock/${sessionId}`)),
  getMockInterviewHistory: (studentId, limit = 20) =>
    request(api.get(`/api/interview/mock/student/${studentId}`, { params: { limit } })),
};

export default api;
