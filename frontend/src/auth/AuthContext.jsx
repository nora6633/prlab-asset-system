import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { setAuthToken } from "../api/client.js";

const STORAGE_KEY = "prlab.auth";
const AuthContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(readStored);

  useEffect(() => {
    setAuthToken(state?.access_token ?? null);
  }, [state]);

  const login = useCallback((payload) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setState(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(null);
  }, []);

  const value = useMemo(
    () => ({
      user: state,
      isLoggedIn: Boolean(state),
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
