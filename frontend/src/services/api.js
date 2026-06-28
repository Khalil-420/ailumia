import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Simple in-memory cache — persists for the session, cleared on logout
const _cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearEmailCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

export const login = (username, password) => api.post('/auth/login', { username, password });
export const logout = () => api.post('/auth/logout');
export const getCurrentUser = () => api.get('/auth/me');

export const getEmails = async (folder = 'INBOX', limit = 50) => {
  const key = `emails_${folder}_${limit}`;
  const now = Date.now();
  if (_cache[key] && (now - _cache[key].ts) < CACHE_TTL) {
    return _cache[key].data;
  }
  const res = await api.get('/emails', { params: { folder, limit } });
  _cache[key] = { data: res, ts: now };
  return res;
};

export const invalidateEmailCache = (folder = null) => {
  if (folder) {
    Object.keys(_cache).filter(k => k.startsWith(`emails_${folder}`)).forEach(k => delete _cache[k]);
  } else {
    clearEmailCache();
  }
};

export const sendEmail = (to, subject, body, originalId = null, inReplyTo = null, attachments = []) => {
  invalidateEmailCache('SENT');
  invalidateEmailCache('INBOX');
  const form = new FormData();
  form.append('to', to);
  form.append('subject', subject);
  form.append('body', body);
  if (originalId) form.append('original_id', originalId);
  if (inReplyTo)  form.append('in_reply_to', inReplyTo);
  attachments.forEach(file => form.append('attachments', file));
  return api.post('/emails/send', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const emailAction = (emailId, operation, folder = 'INBOX', messageId = '') => {
  invalidateEmailCache();
  return api.post(`/emails/${emailId}/action`, { operation, folder, message_id: messageId });
};

export const getEmployeeLogs  = (userId) => api.get(`/admin/employees/${userId}/logs`);
export const getAdminEmail    = (userId, emailId, folder) =>
  api.get(`/admin/employees/${userId}/email/${encodeURIComponent(emailId)}`, { params: { folder } });

export const summarizeEmail = (emailId, folder = 'INBOX') =>
  api.post(`/emails/${emailId}/summarize`, null, { params: { folder } });

export const getSmartReplies = (emailId, folder = 'INBOX', hint = '') =>
  api.post(`/emails/${emailId}/smart-replies`, { hint }, { params: { folder } });

export const getImportantCount = async () => {
  const res = await api.get('/conversations/important-count');
  return res.data.count;
};

export const getImportantThreads = async (limit = 10) => {
  const res = await api.get('/conversations/important', { params: { limit } });
  return res.data;
};

export default api;
