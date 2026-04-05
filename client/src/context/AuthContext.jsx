import { createContext, startTransition, useEffect, useState } from 'react';

import { getCurrentUser, loginRequest } from '../services/api';

const TOKEN_STORAGE_KEY = 'dahej-control-system-token';

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
    const nextToken = response.data.token;

    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);

    startTransition(() => {
      setToken(nextToken);
      setUser(response.data.user);
    });

    return response.data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
        logout,
        token,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
