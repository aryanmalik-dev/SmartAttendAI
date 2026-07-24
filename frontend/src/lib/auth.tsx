import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { login as loginRequest, me } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem("smartattend.token"));
  const query = useQuery({ queryKey: ["me", token], queryFn: me, enabled: Boolean(token), retry: false });
  const mutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginRequest(email, password),
    onSuccess: (data) => {
      localStorage.setItem("smartattend.token", data.access_token);
      setToken(data.access_token);
    }
  });

  useEffect(() => {
    if (query.error) {
      localStorage.removeItem("smartattend.token");
      setToken(null);
    }
  }, [query.error]);

  const value = useMemo<AuthContextValue>(() => ({
    user: query.data ?? null,
    isLoading: query.isLoading || mutation.isPending,
    signIn: async (email, password) => {
      await mutation.mutateAsync({ email, password });
    },
    signOut: () => {
      localStorage.removeItem("smartattend.token");
      setToken(null);
    }
  }), [query.data, query.isLoading, mutation.isPending]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
