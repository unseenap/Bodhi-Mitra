import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, LockKey } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { departments } from "@bodhi/shared";
import { AuthExperience, OtpVisual } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function RegisterPage() {
  const [stage, setStage] = useState<"details" | "otp">("details");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (stage === "details") {
        const result = await api<{ identifier: string }>("/auth/student/register", { method: "POST", body: JSON.stringify({ ...data, mobileNumber: `+91${data.mobileNumber}` }) });
        setIdentifier(result.identifier); setStage("otp");
      } else {
        const result = await api<any>("/auth/student/verify-otp", { method: "POST", body: JSON.stringify({ identifier, otp: data.otp }) });
        signIn(result.token, result.user); navigate("/student");
      }
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  return <AuthExperience variant="register" eyebrow={stage === "details" ? "Student registration" : "Final verification"} title={stage === "details" ? "Create your private support account" : "One last secure step"} description={stage === "details" ? "Verify your university identity once, then access care with confidence." : "Enter the code from your inbox to activate your account."}>
    <div className="auth-progress" aria-label={`Registration step ${stage === "details" ? 1 : 2} of 2`}>
      <span className="active"><i>{stage === "otp" ? <Check /> : "1"}</i><b>Account details</b></span><hr /><span className={stage === "otp" ? "active" : ""}><i>2</i><b>Email verification</b></span>
    </div>
    {stage === "otp" && <OtpVisual identifier={identifier} />}
    <form className={`auth-form ${stage === "details" ? "auth-form--registration" : ""}`} onSubmit={submit}>
      {stage === "details" ? <div className="auth-fields-grid">
        <Field label="Full name" name="fullName" autoComplete="name" placeholder="Your full name" required />
        <Field label="University roll number" name="rollNumber" autoCapitalize="characters" pattern="[0-9]{3}[A-Za-z]{3}[0-9]{3}" maxLength={9} placeholder="235UCS006" hint="Exactly 9 characters" required />
        <div className="auth-field-wide"><SelectField label="School / department" name="department" options={departments} required /></div>
        <Field label="University email" name="email" type="email" autoComplete="email" placeholder="you@gbu.ac.in" required />
        <Field label="Mobile number" name="mobileNumber" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit number" hint="Used only for account support" required />
      </div> : <Field className="otp-input" label="6-digit verification code" name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required />}
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy}>{busy ? <><i className="auth-spinner" /> Please wait…</> : <>{stage === "details" ? "Create account securely" : "Verify and continue"}<ArrowRight weight="bold" /></>}</Button>
      {stage === "otp" ? <button className="auth-back" type="button" onClick={() => { setStage("details"); setError(""); }}><ArrowLeft /> Correct my details</button> : <p className="auth-switch"><LockKey /> Already registered? <Link to="/login">Sign in</Link></p>}
    </form>
  </AuthExperience>;
}
