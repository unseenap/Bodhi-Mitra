import { describe, expect, it } from "vitest";
import { buildIceServers, mediaConstraints } from "./webrtc";

describe("WebRTC production configuration", () => {
  it("requests processed audio without opening a camera for voice calls", () => {
    const constraints = mediaConstraints("voice");
    expect(constraints.video).toBe(false);
    expect(constraints.audio).toMatchObject({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
  });

  it("requests a user-facing HD camera for video calls", () => {
    expect(mediaConstraints("video").video).toMatchObject({ facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } });
  });

  it("adds authenticated TURN relays and supports fallback URLs", () => {
    const servers = buildIceServers({
      stunUrl: "stun:one.example, stun:two.example",
      turnUrl: "turn:relay.example:3478?transport=udp, turns:relay.example:5349?transport=tcp",
      turnUsername: "user",
      turnCredential: "secret"
    });
    expect(servers).toHaveLength(2);
    expect(servers[1]).toMatchObject({ username: "user", credential: "secret" });
    expect(servers[1].urls).toHaveLength(2);
  });

  it("does not install an incomplete TURN configuration", () => {
    expect(buildIceServers({ turnUrl: "turn:relay.example" })).toHaveLength(1);
  });
});
