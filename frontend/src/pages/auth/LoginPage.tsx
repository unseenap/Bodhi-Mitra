import { useState, type FormEvent } from "react";
import { ArrowRight, IdentificationCard, LockKey, UserCircle } from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Role } from "@bodhi/shared";
import { AuthExperience } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const roles: { value: Role; label: string; note: string; icon: typeof UserCircle }[] = [
  { value: "student", label: "Student", note: "Password sign-in", icon: UserCircle },
  { value: "psychologist", label: "Psychologist", note: "Staff access", icon: IdentificationCard },
  { value: "admin", label: "Admin", note: "Control panel", icon: LockKey },
];

export function LoginPage() {
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = role === "student"
        ? { identifier: String(data.identifier).trim(), password: data.password, role }
        : { email: String(data.email).trim().toLowerCase(), password: data.password, role };
      const result = await api<any>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
      signIn(result.token, result.user);
      navigate(result.user.mustChangePassword ? "/change-password" : `/${role}`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <AuthExperience eyebrow="Secure sign in" title="Welcome back" description="Choose your role and continue to your private support space.">
    <div className="auth-role-grid" role="tablist" aria-label="Choose account type">
      {roles.map(({ value, label, note, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={role === value} className={role === value ? "active" : ""} onClick={() => { setRole(value); setError(""); }}>
        <Icon weight={role === value ? "fill" : "duotone"} /><span><strong>{label}</strong><small>{note}</small></span>
      </button>)}
    </div>
    <form className="auth-form" onSubmit={submit}>
      {successMessage && <div className="auth-success" role="status">{successMessage}</div>}
      {role === "student"
        ? <Field label="Email or university roll number" name="identifier" autoComplete="username" placeholder="235UCS006 or you@gbu.ac.in" required />
        : <Field label="Work email" name="email" type="email" autoComplete="username" placeholder="you@gbu.ac.in" required />}
      <Field label="Password" name="password" type="password" autoComplete="current-password" minLength={8} placeholder="Enter your password" required />
      {role === "student" && <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>}
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy}>{busy ? <><i className="auth-spinner" /> Signing in securely...</> : <>Sign in securely <ArrowRight weight="bold" /></>}</Button>
      {role === "student" && <p className="auth-switch">New to Bodhi-Mitra? <Link to="/register">Create student account</Link></p>}
    </form>
  </AuthExperience>;
}
