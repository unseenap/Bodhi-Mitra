import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { departments } from "@bodhi/shared";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { useAuth } from "../../context/AuthContext";

export function RegisterPage() {
  const [stage, setStage] = useState<"details" | "otp">("details"); const [identifier, setIdentifier] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const { signIn } = useAuth(); const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget)); try { if (stage === "details") { const result = await api<{ identifier: string }>("/auth/student/register", { method: "POST", body: JSON.stringify({ ...data, mobileNumber: `+91${data.mobileNumber}` }) }); setIdentifier(result.identifier); setStage("otp"); } else { const result = await api<any>("/auth/student/verify-otp", { method: "POST", body: JSON.stringify({ identifier, otp: data.otp }) }); signIn(result.token, result.user); navigate("/student"); } } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }
  return <section className="auth-page"><div className="auth-intro"><p className="eyebrow">Student account</p><h1>{stage === "details" ? "Create your private support account" : "Check your email"}</h1><p>{stage === "details" ? "Your identity is verified for safety, then shielded during support sessions." : `Enter the 6-digit code sent to ${identifier}.`}</p></div><form className="form-panel" onSubmit={submit}>{stage === "details" ? <><Field label="Full name" name="fullName" autoComplete="name" required/><Field label="Roll number" name="rollNumber" autoCapitalize="characters" pattern="[0-9]{3}[A-Za-z]{3}[0-9]{3}" maxLength={9} hint="9 characters, for example 235UCS006" required/><SelectField label="Department" name="department" options={departments} required/><Field label="Email" name="email" type="email" autoComplete="email" required/><Field label="Mobile number" name="mobileNumber" inputMode="numeric" pattern="[6-9][0-9]{9}" hint="Stored for future account support. Not used for OTP." required/></> : <Field label="6-digit code" name="otp" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required/>}{error && <div className="form-error" role="alert">{error}</div>}<Button disabled={busy}>{busy ? "Please wait..." : stage === "details" ? "Email my code" : "Verify account"}</Button></form></section>;
}
