import { useState, type FormEvent } from "react";
import { ArrowRight, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthExperience } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function ChangePasswordPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to={`/${user.role}`} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) { setError("New passwords do not match"); return; }
    setBusy(true); setError("");
    try {
      const result = await api<any>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      signIn(result.token, result.user); navigate(`/${result.user.role}`, { replace: true });
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <AuthExperience eyebrow="Account protection" title="Create your private password" description="Your temporary password must be replaced before you enter the professional workspace.">
    <div className="password-security-note"><ShieldCheck weight="duotone" /><span><strong>Required security step</strong><small>Use at least 12 characters and avoid passwords used elsewhere.</small></span></div>
    <form className="auth-form" onSubmit={submit}>
      <Field label="Temporary password" name="currentPassword" type="password" autoComplete="current-password" required />
      <Field label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={12} hint="At least 12 characters" required />
      <Field label="Confirm new password" name="confirmation" type="password" autoComplete="new-password" minLength={12} required />
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy}>{busy ? "Protecting account..." : <><LockKey /> Save password and continue <ArrowRight /></>}</Button>
    </form>
  </AuthExperience>;
}
