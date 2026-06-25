import { createContext, startTransition, useEffect, useState } from 'react';

import { getCurrentUser, loginRequest, loginMfaRequest } from '../services/api';

const TOKEN_STORAGE_KEY = 'dahej-control-system-token';
const REFRESH_TOKEN_KEY = 'dahej-control-system-refresh-token';

function getStoredToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function hydrateSession() {
      if (!token) {
        setIsReady(true);
        return;
      }

      try {
        const response = await getCurrentUser(token);
        startTransition(() => {
          setUser(response.data.user);
        });
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsReady(true);
      }
    }

    hydrateSession();
  }, [token]);

  async function login(credentials) {
    const response = await loginRequest(credentials);
    
    if (response.data.mfaRequired) {
      return response.data; // Return raw MFA required payload
    }

    const nextToken = response.data.accessToken || response.data.token;
    const currentUser = response.data.user;
    const nextRefreshToken = response.data.refreshToken;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    if (nextRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }

    startTransition(() => {
      setToken(nextToken);
      setUser(currentUser);
    });

    return currentUser;
  }

  async function loginMfa(payload) {
    const response = await loginMfaRequest(payload);
    const nextToken = response.data.accessToken || response.data.token;
    const currentUser = response.data.user;
    const nextRefreshToken = response.data.refreshToken;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    if (nextRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    }

    startTransition(() => {
      setToken(nextToken);
      setUser(currentUser);
    });

    return currentUser;
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    startTransition(() => {
      setToken(null);
      setUser(null);
    });
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(token),
        isReady,
        login,
        loginMfa,
        logout,
        token,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
