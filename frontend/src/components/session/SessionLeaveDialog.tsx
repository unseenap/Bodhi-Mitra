import { ArrowLeft, LockKey, PhoneDisconnect, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

type SessionLeaveDialogProps = {
  open: boolean;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SessionLeaveDialog({ open, pending, error, onCancel, onConfirm }: SessionLeaveDialogProps) {
  const stayButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stayButton.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, pending, onCancel]);

  if (!open) return null;
  return <div className="session-leave-backdrop" role="presentation">
    <section className="session-leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-leave-title" aria-describedby="session-leave-description">
      <div className="session-leave-dialog__icon"><WarningCircle weight="duotone" /></div>
      <span>Active support session</span>
      <h2 id="session-leave-title">End this session and leave?</h2>
      <p id="session-leave-description">Leaving will close the secure conversation for both participants. You will not be able to continue this session.</p>
      <div className="session-leave-dialog__assurance"><ShieldCheck weight="fill" /><div><strong>Your privacy remains protected</strong><small>The session is ended on the server before this page closes.</small></div></div>
      {error && <div className="session-leave-dialog__error" role="alert"><LockKey /> {error}</div>}
      <div className="session-leave-dialog__actions">
        <button ref={stayButton} type="button" className="session-leave-dialog__stay" onClick={onCancel} disabled={pending}><ArrowLeft /> Stay in session</button>
        <button type="button" className="session-leave-dialog__end" onClick={onConfirm} disabled={pending}><PhoneDisconnect weight="fill" /> {pending ? "Ending securely..." : "End and leave"}</button>
      </div>
    </section>
  </div>;
}
