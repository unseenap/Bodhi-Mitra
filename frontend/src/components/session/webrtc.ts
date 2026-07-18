import type { SessionMode } from "@bodhi/shared";

type IceConfig = {
  stunUrl?: string;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
};

export function buildIceServers(config: IceConfig): RTCIceServer[] {
  const stunUrls = (config.stunUrl || "stun:stun.l.google.com:19302").split(",").map(value => value.trim()).filter(Boolean);
  const servers: RTCIceServer[] = [{ urls: stunUrls }];
  const turnUrls = config.turnUrl?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  if (turnUrls.length && config.turnUsername && config.turnCredential) {
    servers.push({ urls: turnUrls, username: config.turnUsername, credential: config.turnCredential });
  }
  return servers;
}

export function mediaConstraints(mode: SessionMode): MediaStreamConstraints {
  return {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: mode === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
  };
}

export function mediaFailureMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "Microphone or camera permission is blocked. Allow access in your browser site settings, then retry.";
  if (name === "NotFoundError") return "No working microphone or camera was found on this device.";
  if (name === "NotReadableError") return "The microphone or camera is already in use by another application.";
  return "Your microphone or camera could not be started. Check the device and try again.";
}
