import { useEffect, useMemo, useState } from "react";
import { DeviceMobile, DownloadSimple, Monitor, ShareNetwork, X } from "@phosphor-icons/react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);
  const isIos = useMemo(() => /iphone|ipad|ipod/i.test(navigator.userAgent), []);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const complete = () => { setPrompt(null); setInstalled(true); setShowHelp(false); };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const modeChanged = () => setInstalled(isStandalone());
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    displayMode.addEventListener?.("change", modeChanged);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      displayMode.removeEventListener?.("change", modeChanged);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) { setShowHelp(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return <>
    <button type="button" className={`install-app ${className}`.trim()} onClick={() => void install()} aria-haspopup={!prompt ? "dialog" : undefined}>
      <DownloadSimple weight="bold" /> Install app
    </button>
    {showHelp && <div className="pwa-help-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowHelp(false); }}>
      <section className="pwa-help" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title">
        <button className="pwa-help__close" type="button" onClick={() => setShowHelp(false)} aria-label="Close installation help"><X /></button>
        <span className="pwa-help__icon">{isIos ? <DeviceMobile weight="duotone" /> : <Monitor weight="duotone" />}</span>
        <small>INSTALL BODHI-MITRA</small>
        <h2 id="pwa-help-title">Add support to your home screen</h2>
        {isIos ? <ol>
          <li><ShareNetwork weight="duotone" /><span><strong>Tap the Share button</strong><small>Find it in the Safari toolbar.</small></span></li>
          <li><DownloadSimple weight="duotone" /><span><strong>Select “Add to Home Screen”</strong><small>Scroll down in the Share menu if needed.</small></span></li>
          <li><DeviceMobile weight="duotone" /><span><strong>Tap Add</strong><small>Bodhi-Mitra will open like an app.</small></span></li>
        </ol> : <ol>
          <li><Monitor weight="duotone" /><span><strong>Open the browser menu</strong><small>Use the three-dot menu near the address bar.</small></span></li>
          <li><DownloadSimple weight="duotone" /><span><strong>Choose “Install Bodhi-Mitra”</strong><small>It may appear as “Install app” or “Add to Home screen”.</small></span></li>
        </ol>}
        <p>The automatic install prompt is not available in this browser right now. The manual option above installs the same secure PWA.</p>
      </section>
    </div>}
  </>;
}
