import axios from 'axios';

// En producción apunta al backend de Railway, en dev usa el proxy de Vite
const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('luxury_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('luxury_token');
      localStorage.removeItem('luxury_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
