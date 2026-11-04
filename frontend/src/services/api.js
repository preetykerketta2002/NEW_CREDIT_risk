import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

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
