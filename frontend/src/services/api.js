import axios from 'axios';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_BASE_URL = `${API_ORIGIN}/api`;
axios.defaults.withCredentials = true;
if (API_ORIGIN.includes('ngrok')) {
  // Free ngrok endpoints show a browser warning unless API requests opt out.
  axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
}

export const getCurrentUser = async () => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`);
  return response.data.user;
};

export const loginUser = async (credentials) => {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
  return response.data.user;
};

export const registerUser = async (details) => {
  const response = await axios.post(`${API_BASE_URL}/auth/register`, details);
  return response.data.user;
};

export const logoutUser = async () => {
  const response = await axios.post(`${API_BASE_URL}/auth/logout`);
  return response.data;
};

// Get all entities
export const getEntities = async () => {
  const response = await axios.get(`${API_BASE_URL}/credit-risk/entities`);
  return response.data;
};

// Evaluate single entity
export const evaluateEntity = async (entityData) => {
  const response = await axios.post(`${API_BASE_URL}/credit-risk/evaluate`, entityData);
  return response.data;
};

// Search history persisted in MySQL through FastAPI
export const getSearchHistory = async () => {
  const response = await axios.get(`${API_BASE_URL}/search-history`);
  return response.data;
};

export const saveSearchHistory = async (query) => {
  const response = await axios.post(`${API_BASE_URL}/search-history`, { query });
  return response.data;
};

export const clearSearchHistory = async () => {
  const response = await axios.delete(`${API_BASE_URL}/search-history`);
  return response.data;
};
