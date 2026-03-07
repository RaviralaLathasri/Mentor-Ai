import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:8001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth headers if needed
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const profileAPI = {
  // Create student profile
  createProfile: async (profileData) => {
    try {
      const response = await api.post('/api/profile/create', profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get student profile
  getProfile: async (studentId) => {
    try {
      const response = await api.get(`/api/profile/${studentId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update student profile
  updateProfile: async (studentId, profileData) => {
    try {
      const response = await api.put(`/api/profile/${studentId}`, profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export const chatAPI = {
  // Send chat message (uses mentor API)
  sendMessage: async (messageData) => {
    try {
      const response = await api.post('/api/mentor/respond', {
        student_id: messageData.student_id,
        query: messageData.message,
        focus_concept: messageData.focus_concept || null,
        context: messageData.context || null
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export const wellnessAPI = {
  // Get wellness data
  getWellness: async (studentId) => {
    try {
      const response = await api.get(`/api/wellness/${studentId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export const mentorAPI = {
  // Get mentor response
  getMentorResponse: async (queryData) => {
    try {
      const response = await api.post('/api/mentor', queryData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export default api;