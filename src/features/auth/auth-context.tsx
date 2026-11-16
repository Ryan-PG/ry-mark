/**
 * Auth context: drives the application gate (login / setup / error / ready).
 *
 * The SPA shell is public so it can display the appropriate screen; every
 * actual content request is protected server-side regardless of what this
 * client renders (defense in depth — see docs/AUTHENTICATION.md).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, type AuthStatusResponse } from "../../lib/api";

export type AuthGate =
  | { phase: "loading" }
  | { phase: "public"; status: AuthStatusResponse }
  | { phase: "authenticated"; status: AuthStatusResponse }
  | { phase: "login"; status: AuthStatusResponse }
  | { phase: "unconfigured"; status: AuthStatusResponse }
  | { phase: "malformed"; status: AuthStatusResponse }
  | { phase: "missing-session-secret"; status: AuthStatusResponse };

interface AuthContextValue {
  gate: AuthGate;
  refresh: () => Promise<void>;
  login: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function gateFromStatus(status: AuthStatusResponse): AuthGate {
  if (!status.enabled) return { phase: "public", status };
  if (status.state === "ok") {
    return status.authenticated
      ? { phase: "authenticated", status }
      : { phase: "login", status };
  }
  if (status.state === "unconfigured") return { phase: "unconfigured", status };
  if (status.state === "malformed") return { phase: "malformed", status };
  return { phase: "missing-session-secret", status };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<AuthGate>({ phase: "loading" });

  const refresh = useCallback(async () => {
    try {
      const status = await authApi.status();
      setGate(gateFromStatus(status));
    } catch {
      // Network/API failure: fail closed to the setup screen.
      setGate({
        phase: "unconfigured",
        status: {
          enabled: true,
          state: "unconfigured",
          authenticated: false,
          message: "Could not reach the authentication endpoint.",
        },
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback<AuthContextValue["login"]>(
    async (password) => {
      const result = await authApi.login(password);
      if (result.ok) {
        await refresh();
        return { ok: true } as const;
      }
      return { ok: false, error: result.error } as const;
    },
    [refresh],
  );

  const logout = useCallback<AuthContextValue["logout"]>(async () => {
    await authApi.logout();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ gate, refresh, login, logout }),
    [gate, refresh, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>.");
  return context;
}
