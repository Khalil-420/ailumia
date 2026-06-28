import { useState, useEffect } from 'react';
import { login as apiLogin, getCurrentUser, logout as apiLogout } from '../services/api';

export const useAuth = () => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      getCurrentUser()
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('access_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await apiLogin(username, password);
    localStorage.setItem('access_token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try { await apiLogout(); } catch (_) {}
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return { user, loading, login, logout };
};
