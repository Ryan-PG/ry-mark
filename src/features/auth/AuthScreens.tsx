/**
 * Auth screens: login, unconfigured setup instructions, and configuration
 * error states. These are part of the public shell; no secret data is ever
 * displayed, only configuration guidance.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Lock, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { BrandMark } from "../navigation/Sidebar";
import { useAuth } from "./auth-context";

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandMark className="size-12" />
          <div className="text-center">
            <p className="text-lg font-semibold tracking-tight">Ry-Mark</p>
            <p className="text-sm text-muted-foreground">Private documentation viewer</p>
          </div>
        </div>
        <div className="rounded-xl border bg-surface p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Login ---------------------------------- */

export function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await login(password);
    if (!result.ok) {
      setError(result.error);
      setPassword("");
    }
    setSubmitting(false);
  };

  return (
    <AuthShell>
      <form onSubmit={onSubmit} aria-labelledby="rymark-login-title">
        <h1 id="rymark-login-title" className="text-base font-semibold">
          Sign in to continue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This documentation is protected by a shared password.
        </p>
        <div className="mt-5 space-y-3">
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
              required
              aria-label="Password"
              className="pl-9"
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting || password.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

/* ------------------------------- Setup screen ------------------------------ */

export function SetupScreen({ variant }: { variant: "unconfigured" | "malformed" | "missing-session-secret" }) {
  const { refresh } = useAuth();

  const heading =
    variant === "malformed"
      ? "Password protection is misconfigured"
      : variant === "missing-session-secret"
        ? "Session secret is not configured"
        : "Password protection is not configured";

  const intro =
    variant === "malformed"
      ? "The configured PASSWORD_HASH is malformed or uses an unsupported format. Access stays locked until it is replaced with a valid hash."
      : variant === "missing-session-secret"
        ? "A valid password hash is configured, but SESSION_SECRET is missing or too short. Access stays locked until it is provided."
        : "To enable access, the administrator must generate a password hash and store it as an encrypted secret.";

  return (
    <AuthShell>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-warning-soft p-2">
          {variant === "malformed" ? (
            <ShieldAlert className="size-5 text-warning" aria-hidden="true" />
          ) : (
            <Wrench className="size-5 text-warning" aria-hidden="true" />
          )}
        </div>
        <div>
          <h1 className="text-base font-semibold">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>

      {variant !== "missing-session-secret" ? (
        <ol className="mt-5 space-y-2.5 rounded-lg bg-muted/60 p-4 text-sm leading-relaxed">
          <li>
            <span className="font-medium">1. Run:</span>
            <code className="kbd mt-1 block w-fit">npm run hash:password</code>
          </li>
          <li>
            <span className="font-medium">2. Copy the generated hash.</span>
          </li>
          <li>
            <span className="font-medium">3. Open your Cloudflare Pages project.</span>
          </li>
          <li>
            <span className="font-medium">4. Navigate to</span>{" "}
            <span className="font-mono text-xs">Settings &gt; Variables and Secrets</span>
          </li>
          <li>
            <span className="font-medium">5. Create an encrypted Secret named</span>{" "}
            <code className="kbd">PASSWORD_HASH</code>
            <span className="font-medium"> and paste the hash.</span>
          </li>
          <li>
            <span className="font-medium">6. Create another encrypted Secret named</span>{" "}
            <code className="kbd">SESSION_SECRET</code>
            <span className="font-medium"> (a long random value, min 32 characters).</span>
          </li>
          <li>
            <span className="font-medium">7. Save and redeploy if required.</span>
          </li>
          <li>
            <span className="font-medium">Refresh this page after configuration.</span>
          </li>
        </ol>
      ) : (
        <p className="mt-5 rounded-lg bg-muted/60 p-4 text-sm leading-relaxed">
          Generate a long random value (for example with <code className="kbd">openssl rand -base64 48</code>)
          and store it as an encrypted secret named <code className="kbd">SESSION_SECRET</code> in
          your deployment environment. See{" "}
          <span className="font-mono text-xs">docs/PASSWORD-SETUP.md</span> for details.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Full instructions: <span className="font-mono">docs/PASSWORD-SETUP.md</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Recheck configuration
        </Button>
      </div>
    </AuthShell>
  );
}

/* ------------------------------ Gate renderer ------------------------------ */

export function AuthGateScreen({ phase }: { phase: "unconfigured" | "malformed" | "missing-session-secret" }) {
  return <SetupScreen variant={phase} />;
}
