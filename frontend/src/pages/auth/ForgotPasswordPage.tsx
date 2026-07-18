import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, LockKey } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { AuthExperience, OtpVisual } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useOtpCooldown } from "../../hooks/useOtpCooldown";
import { api } from "../../lib/api";

export function ForgotPasswordPage() {
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cooldown = useOtpCooldown();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (stage === "reset" && newPassword !== confirmation) { setError("Passwords do not match"); return; }
    setBusy(true);
    try {
      if (stage === "request") {
        await api("/auth/student/forgot-password", { method: "POST", body: JSON.stringify({ identifier: identifier.trim() }) });
        setStage("reset");
        cooldown.start();
      } else {
        await api("/auth/student/reset-password", { method: "POST", body: JSON.stringify({ identifier: identifier.trim(), otp, newPassword }) });
        navigate("/login", { replace: true, state: { message: "Password reset successfully. Sign in with your new password." } });
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!cooldown.ready || busy) return;
    setBusy(true); setError("");
    try {
      await api("/auth/student/forgot-password", { method: "POST", body: JSON.stringify({ identifier: identifier.trim() }) });
      setOtp(""); cooldown.start();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <AuthExperience eyebrow="Student account recovery" title={stage === "request" ? "Reset your password" : "Verify and secure your account"} description={stage === "request" ? "We will send a secure code to the email registered with your account." : "Enter your email code and choose a new private password."}>
    {stage === "reset" && <OtpVisual identifier={identifier} conditional />}
    <div className="password-security-note"><LockKey weight="duotone" /><span><strong>Email verification required</strong><small>For privacy, we show the same response whether or not an account exists.</small></span></div>
    <form className="auth-form" onSubmit={submit}>
      {stage === "request" ? <Field label="Email or university roll number" name="identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" placeholder="235UCS006 or you@gbu.ac.in" required /> : <>
        <Field className="otp-input" label="6-digit reset code" name="verificationCode" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required />
        <Field label="New password" name="newPassword" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} hint="At least 12 characters" required />
        <Field label="Confirm new password" name="confirmation" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required />
      </>}
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy || (stage === "reset" && otp.length !== 6)}>{busy ? "Please wait..." : stage === "request" ? <>Send reset code <ArrowRight /></> : <><CheckCircle /> Reset password securely</>}</Button>
      {stage === "reset" && <button className="auth-resend" type="button" disabled={!cooldown.ready || busy} onClick={() => void resend()}>{cooldown.ready ? "Send a new code" : `Send a new code in ${cooldown.seconds}s`}</button>}
      <Link className="auth-back" to="/login"><ArrowLeft /> Back to sign in</Link>
    </form>
  </AuthExperience>;
}
