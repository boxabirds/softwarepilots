import { useState, useEffect } from "react";
import { apiClient } from "./api-client";

interface Learner {
  id: string;
  email: string;
  display_name: string;
  enrolled_at: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  learner: Learner | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    learner: null,
  });

  useEffect(() => {
    apiClient
      .get<Learner>("/api/auth/me")
      .then((learner) => {
        setState({ isAuthenticated: true, isLoading: false, learner });
      })
      .catch(() => {
        setState({ isAuthenticated: false, isLoading: false, learner: null });
      });
  }, []);

  return state;
}

export function loginUrl(): string {
  return "/api/auth/login";
}
