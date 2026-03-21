import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('thingual_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const onboardingService = {
  startTest: async () => {
    const response = await api.post('/onboarding/start');
    return response.data;
  },

  submitMcqAnswer: async (data: {
    question_type: string;
    question_id: number;
    user_answer: string;
    response_time?: number;
  }) => {
    const response = await api.post('/onboarding/answer', data);
    return response.data;
  },

  submitSpeech: async (formData: FormData) => {
    const response = await api.post('/onboarding/speech', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getResults: async () => {
    const response = await api.get('/onboarding/result');
    return response.data;
  },
};

export default api;
