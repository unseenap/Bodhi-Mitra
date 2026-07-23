export type PwaRegistrationStatus = "ready" | "unsupported" | "error";
export const PWA_STATUS_EVENT = "bodhi:pwa-status";

function announce(status: PwaRegistrationStatus, message?: string) {
  window.dispatchEvent(new CustomEvent(PWA_STATUS_EVENT, { detail: { status, message } }));
}

export async function registerPwa() {
  if (!("serviceWorker" in navigator)) {
    announce("unsupported", "This browser does not support service workers.");
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await registration.update();
    announce("ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service worker registration failed.";
    console.error("Bodhi-Mitra PWA registration failed", error);
    announce("error", message);
  }
}

