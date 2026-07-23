import { useEffect, useMemo, useState } from "react";
import { DeviceMobile, DownloadSimple, Monitor, ShareNetwork, WarningCircle, X } from "@phosphor-icons/react";
import { PWA_STATUS_EVENT, type PwaRegistrationStatus } from "../../lib/pwa";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const promptSubscribers = new Set<(prompt: InstallPromptEvent) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    promptSubscribers.forEach(subscriber => subscriber(deferredPrompt!));
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(() => deferredPrompt);
  const [installed, setInstalled] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);
  const [registration, setRegistration] = useState<{ status: PwaRegistrationStatus | "checking"; message?: string }>({ status: "checking" });
  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(navigator.userAgent), []);

  useEffect(() => {
    const promptAvailable = (nextPrompt: InstallPromptEvent) => setPrompt(nextPrompt);
    const complete = () => { deferredPrompt = null; setPrompt(null); setInstalled(true); setShowHelp(false); };
    const pwaStatus = (event: Event) => setRegistration((event as CustomEvent<{ status: PwaRegistrationStatus; message?: string }>).detail);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const modeChanged = () => setInstalled(isStandalone());
    promptSubscribers.add(promptAvailable);
    window.addEventListener("appinstalled", complete);
    window.addEventListener(PWA_STATUS_EVENT, pwaStatus);
    displayMode.addEventListener?.("change", modeChanged);
    navigator.serviceWorker?.getRegistration().then(value => { if (value) setRegistration({ status: "ready" }); });
    return () => {
      promptSubscribers.delete(promptAvailable);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener(PWA_STATUS_EVENT, pwaStatus);
      displayMode.removeEventListener?.("change", modeChanged);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) { setShowHelp(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    deferredPrompt = null;
    setPrompt(null);
  }

  return <>
    <button type="button" className={`install-app ${prompt ? "install-app--ready" : ""} ${className}`.trim()} onClick={() => void install()} aria-haspopup={!prompt ? "dialog" : undefined}>
      <DownloadSimple weight="bold" /> {prompt ? "Install app" : "Get the app"}
    </button>
    {showHelp && <div className="pwa-help-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowHelp(false); }}>
      <section className="pwa-help" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title">
        <button className="pwa-help__close" type="button" onClick={() => setShowHelp(false)} aria-label="Close installation help"><X /></button>
        <span className="pwa-help__icon">{registration.status === "error" ? <WarningCircle weight="duotone" /> : isIos ? <DeviceMobile weight="duotone" /> : <Monitor weight="duotone" />}</span>
        <small>INSTALL BODHI-MITRA</small>
        <h2 id="pwa-help-title">Add support to your home screen</h2>
        {registration.status === "error" && <div className="pwa-help__error"><strong>Installation service did not start.</strong><span>{registration.message || "Reload this page after the latest deployment is live."}</span></div>}
        {isIos ? <ol>
          <li><ShareNetwork weight="duotone" /><span><strong>Tap the Share button</strong><small>Find it in the Safari toolbar.</small></span></li>
          <li><DownloadSimple weight="duotone" /><span><strong>Select “Add to Home Screen”</strong><small>Scroll down in the Share menu if needed.</small></span></li>
          <li><DeviceMobile weight="duotone" /><span><strong>Tap Add</strong><small>Bodhi-Mitra will open like an app.</small></span></li>
        </ol> : <ol>
          <li><Monitor weight="duotone" /><span><strong>Open Chrome or Edge</strong><small>Firefox does not provide the desktop PWA installation prompt.</small></span></li>
          <li><DownloadSimple weight="duotone" /><span><strong>Choose “Install Bodhi-Mitra”</strong><small>Find it in the address bar or browser menu.</small></span></li>
        </ol>}
        <p>{registration.status === "checking" ? "Installation support is still loading. Reload once if this message remains visible." : "If the automatic prompt is unavailable, the browser menu installs the same secure PWA."}</p>
      </section>
    </div>}
  </>;
}
