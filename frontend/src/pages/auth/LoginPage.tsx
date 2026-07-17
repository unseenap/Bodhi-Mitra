import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, IdentificationCard, LockKey, UserCircle } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import type { Role } from "@bodhi/shared";
import { AuthExperience, OtpVisual } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { useOtpCooldown } from "../../hooks/useOtpCooldown";
import { api } from "../../lib/api";

const roles: { value: Role; label: string; note: string; icon: typeof UserCircle }[] = [
  { value: "student", label: "Student", note: "OTP sign-in", icon: UserCircle },
  { value: "psychologist", label: "Psychologist", note: "Staff access", icon: IdentificationCard },
  { value: "admin", label: "Admin", note: "Control panel", icon: LockKey },
];

export function LoginPage() {
  const [role, setRole] = useState<Role>("student");
  const [otpStage, setOtpStage] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useOtpCooldown();
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (role === "student" && !otpStage) {
        const normalized = String(data.identifier).trim();
        await api("/auth/student/request-otp", { method: "POST", body: JSON.stringify({ identifier: normalized }) });
        setIdentifier(normalized); setOtpStage(true); cooldown.start();
      } else if (role === "student") {
        const result = await api<any>("/auth/student/verify-otp", { method: "POST", body: JSON.stringify({ identifier, otp }) });
        signIn(result.token, result.user); navigate("/student");
      } else {
        const result = await api<any>("/auth/login", { method: "POST", body: JSON.stringify({ ...data, role }) });
        signIn(result.token, result.user); navigate(result.user.mustChangePassword ? "/change-password" : `/${role}`);
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    if (!cooldown.ready || busy) return;
    setBusy(true); setError("");
    try {
      await api("/auth/student/request-otp", { method: "POST", body: JSON.stringify({ identifier }) });
      cooldown.start(); setOtp("");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  const title = otpStage ? "Enter your secure code" : "Welcome back";
  const description = otpStage ? "Your six-digit code expires shortly for your protection." : "Choose your role and continue to your private support space.";

  return <AuthExperience eyebrow={otpStage ? "Identity verification" : "Secure sign in"} title={title} description={description}>
    {!otpStage && <div className="auth-role-grid" role="tablist" aria-label="Choose account type">
      {roles.map(({ value, label, note, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={role === value} className={role === value ? "active" : ""} onClick={() => { setRole(value); setError(""); }}>
        <Icon weight={role === value ? "fill" : "duotone"} /><span><strong>{label}</strong><small>{note}</small></span>
      </button>)}
    </div>}
    {otpStage && <OtpVisual identifier={identifier} conditional />}
    <form className="auth-form" onSubmit={submit}>
      {role === "student" ? otpStage
        ? <Field className="otp-input" label="6-digit verification code" name="verificationCode" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required />
        : <Field label="Email or university roll number" name="identifier" autoComplete="username" placeholder="235UCS006 or you@gbu.ac.in" required />
        : <><Field label="Work email" name="email" type="email" autoComplete="username" placeholder="you@gbu.ac.in" required /><Field label="Password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></>}
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy || (otpStage && otp.length !== 6)}>{busy ? <><i className="auth-spinner" /> Verifying securely...</> : <>{role === "student" ? otpStage ? "Verify and enter" : "Send secure code" : "Sign in securely"}<ArrowRight weight="bold" /></>}</Button>
      {otpStage && <button className="auth-resend" type="button" disabled={!cooldown.ready || busy} onClick={() => void resendCode()}>{cooldown.ready ? "Send a new code" : `Send a new code in ${cooldown.seconds}s`}</button>}
      {otpStage ? <button className="auth-back" type="button" onClick={() => { setOtpStage(false); setOtp(""); setError(""); }}><ArrowLeft /> Use a different account</button>
        : role === "student" && <p className="auth-switch">New to Bodhi-Mitra? <Link to="/register">Create student account</Link></p>}
    </form>
  </AuthExperience>;
}
