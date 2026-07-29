import { createContext, startTransition, useEffect, useState } from 'react';
import {
  getCurrentUser, loginMfaRequest, loginRequest, logoutRequest,
  refreshSessionRequest, setStaffAuthState
} from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  function acceptSession(data) {
    setStaffAuthState(data.accessToken, data.csrfToken);
    startTransition(() => {
      setToken(data.accessToken);
      setUser(data.user);
    });
    return data.user;
  }

  useEffect(() => {
    refreshSessionRequest()
      .then(async (accessToken) => {
        const response = await getCurrentUser(accessToken);
        acceptSession({ accessToken, user: response.data.user });
      })
      .catch(() => setStaffAuthState(null, null))
      .finally(() => setIsReady(true));
  }, []);

  async function login(credentials) {
    const response = await loginRequest(credentials);
    if (response.data.mfaRequired) return response.data;
    return acceptSession(response.data);
  }

  async function loginMfa(payload) {
    const response = await loginMfaRequest(payload);
    return acceptSession(response.data);
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      setStaffAuthState(null, null);
      startTransition(() => {
        setToken(null);
        setUser(null);
      });
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated: Boolean(token), isReady, login, loginMfa, logout, token, user
    }}>
      {children}
    </AuthContext.Provider>
  );
}
