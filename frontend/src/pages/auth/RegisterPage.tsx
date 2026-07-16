import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, EnvelopeSimple, LockKey, PencilSimple } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { departments } from "@bodhi/shared";
import { AuthExperience, OtpVisual } from "../../components/auth/AuthExperience";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

type RegistrationDetails = { fullName: string; rollNumber: string; department: string; email: string; mobileNumber: string };
const initialDetails: RegistrationDetails = { fullName: "", rollNumber: "", department: "", email: "", mobileNumber: "" };

export function RegisterPage() {
  const [stage, setStage] = useState<"details" | "otp">("details");
  const [details, setDetails] = useState(initialDetails);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestTimer = useRef<number | null>(null);
  const requestInFlight = useRef(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => () => { if (requestTimer.current) window.clearTimeout(requestTimer.current); }, []);

  function update<K extends keyof RegistrationDetails>(key: K, value: RegistrationDetails[K]) {
    setDetails(current => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || requestInFlight.current) return;
    setError("");
    if (stage === "details") {
      setBusy(true);
      if (requestTimer.current) window.clearTimeout(requestTimer.current);
      requestTimer.current = window.setTimeout(() => void beginRegistration(), 450);
    } else {
      void verifyRegistration(otp);
    }
  }

  async function beginRegistration() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      const result = await api<{ identifier: string }>("/auth/student/register", { method: "POST", body: JSON.stringify({ ...details, rollNumber: details.rollNumber.toUpperCase(), email: details.email.trim().toLowerCase(), mobileNumber: `+91${details.mobileNumber}` }) });
      setIdentifier(result.identifier); setStage("otp");
    } catch (cause) { setError((cause as Error).message); }
    finally { requestInFlight.current = false; setBusy(false); }
  }

  async function verifyRegistration(otp: string) {
    requestInFlight.current = true; setBusy(true);
    try {
      const result = await api<any>("/auth/student/verify-otp", { method: "POST", body: JSON.stringify({ identifier, otp }) });
      signIn(result.token, result.user); navigate("/student");
    } catch (cause) { setError((cause as Error).message); }
    finally { requestInFlight.current = false; setBusy(false); }
  }

  function editDetails() { setStage("details"); setIdentifier(""); setOtp(""); setError(""); }

  return <AuthExperience variant="register" eyebrow={stage === "details" ? "Student registration" : "Final verification"} title={stage === "details" ? "Create your private support account" : "One last secure step"} description={stage === "details" ? "Your account is created only after your email code is verified." : "Enter the code from your inbox to activate your account."}>
    <div className="auth-progress" aria-label={`Registration step ${stage === "details" ? 1 : 2} of 2`}><span className="active"><i>{stage === "otp" ? <Check /> : "1"}</i><b>Account details</b></span><hr /><span className={stage === "otp" ? "active" : ""}><i>2</i><b>Email verification</b></span></div>
    {stage === "otp" && <><OtpVisual identifier={identifier} /><div className="otp-destination"><EnvelopeSimple weight="duotone" /><div><small>Verification code sent to</small><strong>{identifier}</strong></div><button type="button" onClick={editDetails}><PencilSimple /> Change</button></div></>}
    <form className={`auth-form ${stage === "details" ? "auth-form--registration" : ""}`} onSubmit={submit}>
      {stage === "details" ? <div className="auth-fields-grid">
        <Field label="Full name" name="fullName" value={details.fullName} onChange={event => update("fullName", event.target.value)} autoComplete="name" placeholder="Your full name" required />
        <Field label="University roll number" name="rollNumber" value={details.rollNumber} onChange={event => update("rollNumber", event.target.value.toUpperCase())} autoCapitalize="characters" pattern="[0-9]{3}[A-Za-z]{3}[0-9]{3}" maxLength={9} placeholder="235UCS006" hint="Exactly 9 characters" required />
        <div className="auth-field-wide"><SelectField label="School / department" name="department" value={details.department} onChange={event => update("department", event.target.value)} options={departments} required /></div>
        <Field label="University email" name="email" type="email" value={details.email} onChange={event => update("email", event.target.value)} autoComplete="email" placeholder="you@gbu.ac.in" required />
        <Field label="Mobile number" name="mobileNumber" value={details.mobileNumber} onChange={event => update("mobileNumber", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit number" hint="Used only for account support" required />
      </div> : <Field className="otp-input" label="6-digit verification code" name="verificationCode" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required />}
      {error && <div className="auth-error" role="alert"><span>!</span><p>{error}</p></div>}
      <Button className="auth-submit" disabled={busy}>{busy ? <><i className="auth-spinner" /> Please wait…</> : <>{stage === "details" ? "Send verification code" : "Verify and create account"}<ArrowRight weight="bold" /></>}</Button>
      {stage === "otp" ? <button className="auth-back" type="button" onClick={editDetails}><ArrowLeft /> Correct my details</button> : <p className="auth-switch"><LockKey /> Already registered? <Link to="/login">Sign in</Link></p>}
    </form>
  </AuthExperience>;
}
