// For more info see https://webrtc.org/
// This file is supposed to track 1-1 backend/node/captioner/api/helpers/webrtc.ts
// In ideal scenario the WebRTCManager on all the sides of the WebRTC communication
// has the same exact code, and the only asymmetry should be 'politeness'.

const WEBRTC_CONFIG = {
  // Defaults to 0, but this might make establishing a connection faster
  // iceCandidatePoolSize: 10,
};

export const GOOGLE_STUNS_SERVER = "stun:stun.l.google.com:19302";

type TurnCredentials = RTCIceServer;

export class WebRTCManager {
  //   dispatch: AppDispatch;
  peerConnection: RTCPeerConnection;
  turnCredentials: TurnCredentials[] = [];
  onMessage: undefined | ((message: unknown) => void);
  messageBuffer: Buffer[] = [];
  trackListeners: Array<(track: RTCTrackEvent["track"]) => void> = [];
  // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
  // Perfect negotiation involves a 'polite' and 'impolite' peers. That way
  // it's easy to handle offer collisions - polite peers always drop their own
  // offers, while impolite always force their own offers. Otherwise figuring
  // out which offer to pursue while both are in transit would be difficult.
  polite = false;
  makingOffer = false;

  constructor(
    polite: boolean,
    turnCredentials: TurnCredentials[]
    // dispatch: AppDispatch
  ) {
    // this.dispatch = dispatch;
    // The object can be constructed early, and it will be able to handle
    // messages early. However, it will buffer all the signaling messages
    // it wants to send, and only send them when initialize is called.
    this.polite = polite;
    this.turnCredentials = turnCredentials;

    if (!window.RTCPeerConnection) {
      trackFailedToCreatePeerConnection();
      return;
    }
    this.resetPeerConnection();
  }

  maybeResetPeerConnection() {
    if (this.peerConnection.connectionState === "failed") {
      this.peerConnection.close();
    }
    if (this.peerConnection.connectionState === "closed") {
      this.resetPeerConnection();
    }
  }

  resetPeerConnection() {
    if (
      this.peerConnection &&
      this.peerConnection.connectionState !== "closed"
    ) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      ...WEBRTC_CONFIG,
      iceServers: [...this.turnCredentials, { urls: GOOGLE_STUNS_SERVER }],
    });
    trackPeerConnectionCreated();

    this.peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.handleLocalIceCandidate(event.candidate);
      }
    });

    this.peerConnection.addEventListener("negotiationneeded", async () => {
      this.initiateNegotiation();
    });

    this.peerConnection.addEventListener("track", (event) => {
      this.trackListeners.forEach((f) => f(event.track));
    });

    this.peerConnection.addEventListener("connectionstatechange", () => {
      console.log(
        "connection state change",
        this.peerConnection.connectionState
      );
      //   this.dispatch(
      //     setWebRTCConnectionStatus(this.peerConnection.connectionState)
      //   );
      trackWebRTCConnectionStateChange(this.peerConnection.connectionState);
      if (
        this.peerConnection.connectionState === "failed" ||
        this.peerConnection.connectionState === "closed"
      ) {
        console.log(
          `RTCPeerConnection in state ${this.peerConnection.connectionState}`,
          {
            level: "warning",
            tags: {
              category: "webrtc",
            },
          }
        );
        console.log("stopping audio due to peer connection failure or closure");
        // this.dispatch(stopRecording());
      }
    });
    this.peerConnection.addEventListener("iceconnectionstatechange", () => {
      console.log(
        "ICE connection state change",
        this.peerConnection.iceConnectionState
      );
      trackWebRTCIceConnectionStateChange(
        this.peerConnection.iceConnectionState
      );
      if (
        this.peerConnection.iceConnectionState === "failed" ||
        this.peerConnection.iceConnectionState === "closed"
      ) {
        console.log(
          `RTCPeerConnection in ICE state ${this.peerConnection.iceConnectionState}`,
          {
            level: "warning",
            tags: {
              category: "webrtc",
            },
          }
        );
        console.log("stopping audio due to peer connection failure or closure");
        // this.dispatch(stopRecording());
      }
    });
  }

  public updateIceServers(turnCredentials: TurnCredentials[]): void {
    if (!this.peerConnection) return;
    this.turnCredentials = turnCredentials;
    try {
      this.peerConnection.setConfiguration({
        ...WEBRTC_CONFIG,
        iceServers: [...turnCredentials, { urls: GOOGLE_STUNS_SERVER }],
      });
    } catch (e) {
      console.log(e, {
        tags: {
          category: "webrtc",
        },
      });
    }
  }

  destructor() {
    this.peerConnection?.close();
  }

  initialize(onMessage) {
    // This can only be called once the signaling channel (onMessage function) is ready
    // to accept messages. It will flush all the messages accumulated in the buffer
    // before the signaling channel was ready.
    this.onMessage = onMessage;
    this.maybeFlushMessageBuffer();
  }

  addTrackListener(f) {
    // This will get triggered any time the server publishes a new track.
    this.trackListeners.push(f);
  }

  async initiateNegotiation() {
    this.maybeResetPeerConnection();
    try {
      this.makingOffer = true;
      // Calling it with no arguments 'does the right thing'
      // (check the 'perfect negotiation' link above).
      await this.peerConnection.setLocalDescription();
      await this.sendMessage({
        offer: this.peerConnection.localDescription,
      });
    } finally {
      this.makingOffer = false;
    }
  }

  async handleV1Message(message) {
    if (!message) return false;
    if (message.offer && message.answer) {
      return false;
    }
    if (message.offer) {
      await this.handleOffer(message.offer);
      return true;
    }
    if (message.answer) {
      await this.acceptAnswer(message.answer);
      return true;
    }
    if (message.iceCandidate) {
      await this.addRemoteIceCandidate(message.iceCandidate);
      return true;
    }
    return false;
  }

  async handleOffer(offer) {
    this.maybeResetPeerConnection();
    const offerCollision =
      this.makingOffer || this.peerConnection.signalingState !== "stable";
    if (offerCollision) {
      if (this.polite) {
        await this.peerConnection.setLocalDescription({ type: "rollback" });
      }
    }
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.sendMessage({
      answer,
    });
  }

  async acceptAnswer(answer) {
    const remoteDesc = new RTCSessionDescription(answer);
    try {
      await this.peerConnection.setRemoteDescription(remoteDesc);
    } catch (e) {
      // If setting the remote description failed for whatever reason, then the
      // whole connection needs to be killed.
      console.log(e, {
        tags: {
          category: "webrtc",
        },
      });
      this.peerConnection.close();
    }
  }

  async addRemoteIceCandidate(iceCandidate: RTCIceCandidate) {
    try {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } catch (e) {}
  }

  handleLocalIceCandidate(candidate: RTCIceCandidate) {
    this.sendMessage({
      iceCandidate: candidate,
    });
  }

  sendMessage(message) {
    this.messageBuffer.push(message);
    this.maybeFlushMessageBuffer();
  }
  maybeFlushMessageBuffer() {
    if (this.onMessage) {
      for (const message of this.messageBuffer) {
        this.onMessage(message);
      }
      this.messageBuffer = [];
    }
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.maybeResetPeerConnection();
    trackWebRTCTrackAdded();
    return this.peerConnection.addTrack(track, stream);
  }

  removeSender(sender: RTCRtpSender) {
    try {
      // This might fail if the peer connection is closed or failed, but
      // in such cases, we don't care about removing the track.
      this.peerConnection.removeTrack(sender);
    } catch (e) {}
  }
}

let currentTurnCredentials: TurnCredentials[] = [];
let singletonWebRTCManager: WebRTCManager;

export const setTurnCredentials = (turnCredentials: TurnCredentials[]) => {
  currentTurnCredentials = turnCredentials;
  getSingletonWebRTCManager()?.updateIceServers(turnCredentials);
};

export const recreateSingletonWebRTCManager = () => {
  if (!window.RTCPeerConnection) return;

  if (singletonWebRTCManager) singletonWebRTCManager.destructor();
  singletonWebRTCManager = new WebRTCManager(
    true,
    currentTurnCredentials
    // dispatch
  );
  // Currently we play the most recent track added by the server. This can
  // ultimately be smarter, and we can potentially hold a few tracks and choose
  // them on the client rather than by sending a new downAudio request.
  singletonWebRTCManager.addTrackListener((track) => {
    console.log("got track", track);
    // singletonTrackPlayer.setTrack(track);
  });
};

export const getSingletonWebRTCManager: () =>
  | WebRTCManager
  | undefined = () => {
  return singletonWebRTCManager;
};

const trackFailedToCreatePeerConnection = () => {
  console.log("Web - WebRTC - Failed to create peer connection");
};
const trackPeerConnectionCreated = () => {
  console.log("Web - WebRTC - Peer connection created");
};
const trackWebRTCTrackAdded = () => {
  console.log("Web - WebRTC - Track added");
};
const trackWebRTCConnectionStateChange = (
  connectionState: RTCPeerConnectionState
) => {
  console.log("Web - WebRTC - Connection State Change", {
    connectionState,
  });
};
const trackWebRTCIceConnectionStateChange = (
  iceConnectionState: RTCIceConnectionState
) => {
  console.log("Web - WebRTC - ICEConnection State Change", {
    iceConnectionState,
  });
};
