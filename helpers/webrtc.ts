/* istanbul ignore file */

// For more info see https://webrtc.org/
// This file is supposed to track 1-1 webapp/src/utils/webrtc.js
// In ideal scenario the WebRTCManager on all the sides of the WebRTC communication
// has the same exact code, and the only asymmetry should be 'politeness'.

import wrtc, {
  RTCAudioSource,
  RTCPeerConnection,
  RTCSessionDescription,
} from "wrtc";
import { Webrtc, TurnCredentials } from "./wrtc-types";

const WEBRTC_CONFIG = {
  // Defaults to 0, but this might make establishing a connection faster
  iceCandidatePoolSize: 10,
};

export const GOOGLE_STUNS_SERVER = "stun:stun.l.google.com:19302";

export class WebRTCManager {
  peerConnection?: RTCPeerConnection;
  turnCredentials: TurnCredentials[] = [];
  onMessage?: Function;
  trackListeners: Array<
    (track: MediaStreamTrack, stream: MediaStream) => void
  > = [];
  // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
  // Perfect negotiation involves a 'polite' and 'impolite' peers. That way
  // it's easy to handle offer collisions - polite peers always drop their own
  // offers, while impolite always force their own offers. Otherwise figuring
  // out which offer to pursue while both are in transit would be difficult.
  polite: boolean;
  makingOffer: boolean = false;

  private rtcAudioSource: RTCAudioSource;
  //@ts-ignore
  public rtcAudioTrack: MediaStreamTrack;

  // Messages to be sent before the onMessage function is ready will be buffered
  // here.
  messageBuffer: any[] = [];

  info(message: any) {
    console.log("webrtc", message);
  }
  error(message: any) {
    console.log("webrtc", message);
  }

  constructor(polite: boolean, turnCredentials?: TurnCredentials[]) {
    // The object can be constructed early and it will be able to handle
    // messages early. However, it will buffer all the messages it wants to
    // send and only send them after initialize() has been called.
    this.polite = polite;
    this.turnCredentials = turnCredentials || [];
    this.info(`constructing WebRTCManager with politeness ${polite}`);
    this.resetPeerConnection();
  }

  maybeResetPeerConnection() {
    if (this.peerConnection.connectionState === "failed") {
      this.peerConnection.close();
    }
    if (this.peerConnection.connectionState === "closed") {
      this.info("peer connection is closed - recreating");
      this.resetPeerConnection();
    }
  }

  resetPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      ...WEBRTC_CONFIG,
      iceServers: [...this.turnCredentials, { urls: GOOGLE_STUNS_SERVER }],
    });
    this.peerConnection.addEventListener("icecandidate", (event: any) => {
      this.info("ice candidate appeared");
      if (event.candidate) {
        this.handleLocalIceCandidate(event.candidate);
      }
    });
    this.peerConnection.addEventListener(
      "connectionstatechange",
      (_event: any) => {
        this.info(
          `connection state changed ${this.peerConnection.connectionState}`
        );
      }
    );
    this.peerConnection.addEventListener(
      "iceconnectionstatechange",
      (_event: any) => {
        this.info(
          `iceconnection state changed ${this.peerConnection.iceConnectionState}`
        );
      }
    );
    this.peerConnection.addEventListener(
      "signalingstatechange",
      (_event: any) => {
        this.info(`signalingstatechange ${this.peerConnection.signalingState}`);
      }
    );
    this.peerConnection.addEventListener(
      "negotiationneeded",
      async (_event: any) => {
        this.info("negotiation is needed");
        this.initiateNegotiation();
      }
    );
    this.peerConnection.addEventListener("track", (event: RTCTrackEvent) => {
      if (event.track && event.streams && event.streams.length > 0) {
        this.info(
          `remote track appeared ${event.track.id}, stream id: ${event.streams[0].id}`
        );

        // we always expect a single stream
        // log an error if there are more
        if (event.streams.length > 1) {
          console.error("event.streams.length > 1");
        }

        this.trackListeners.forEach((f) => f(event.track, event.streams[0]));
      } else {
        this.error("event.track or event.streams[0] is undefined");
      }
    });
  }

  destructor() {
    this.onMessage = undefined;
    this.peerConnection.close();
  }

  initialize(onMessage: Function) {
    // This can only be called once the signaling channel (onMessage function) is ready
    // to accept messages.
    this.onMessage = onMessage;
    this.maybeFlushMessageBuffer();
  }

  isInitialized(): boolean {
    return this.onMessage !== undefined;
  }

  createAudioSourceAndTrack(): {
    rtcAudioSource: RTCAudioSource;
    rtcAudioTrack: MediaStreamTrack;
  } {
    const rtcAudioSource = new wrtc.nonstandard.RTCAudioSource();
    const rtcAudioTrack = rtcAudioSource.createTrack();

    this.rtcAudioSource = rtcAudioSource;
    this.rtcAudioTrack = rtcAudioTrack;

    return {
      rtcAudioSource: this.rtcAudioSource,
      rtcAudioTrack: this.rtcAudioTrack,
    };
  }

  addTrackListener(
    f: (track: MediaStreamTrack, stream: MediaStream) => void
  ): void {
    // This will get triggered any time the remote peer publishes a new track.
    this.trackListeners.push(f);
  }

  public updateIceServers(turnCredentials: TurnCredentials[]): void {
    this.peerConnection.setConfiguration({
      ...WEBRTC_CONFIG,
      iceServers: [...turnCredentials, { urls: [GOOGLE_STUNS_SERVER] }],
    });
  }

  async initiateNegotiation() {
    this.info("initiating offer");
    try {
      this.makingOffer = true;
      // This should ideally be without an argument, but:
      // https://github.com/node-webrtc/node-webrtc/issues/677
      await this.peerConnection.setLocalDescription(
        await this.peerConnection.createOffer()
      );
      this.sendMessage({
        offer: this.peerConnection.localDescription,
      });
    } finally {
      this.makingOffer = false;
    }
  }

  async handleV1Message(message: Webrtc) {
    if (message.offer && message.answer) {
      this.error("message cannot contain both offer and answer");
      return false;
    }
    if (message.offer) {
      this.info("handling webrtc offer");
      await this.handleOffer(message.offer);
      return true;
    }
    if (message.answer) {
      this.info("accepting webrtc answer");
      await this.acceptAnswer(message.answer);
      return true;
    }
    if (message.iceCandidate) {
      this.info("received remote ICE candidate");
      await this.addRemoteIceCandidate(message.iceCandidate);
      return true;
    }
    return false;
  }

  async handleOffer(offer: any) {
    this.maybeResetPeerConnection();

    const offerCollision =
      this.makingOffer || this.peerConnection.signalingState != "stable";
    if (offerCollision) {
      if (!this.polite) {
        this.info("offer being ignored, we have our own");
        return;
      }
      if (this.polite) {
        await this.peerConnection.setLocalDescription({ type: "rollback" });
      }
    }
    this.info("accepting offer");
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await this.peerConnection.createAnswer();
    this.info("setting answer");
    await this.peerConnection.setLocalDescription(answer);
    this.sendMessage({
      answer,
    });
  }

  async acceptAnswer(answer: any) {
    const remoteDesc = new RTCSessionDescription(answer);
    await this.peerConnection.setRemoteDescription(remoteDesc);
  }

  async addRemoteIceCandidate(iceCandidate: any) {
    try {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } catch (e) {
      this.info(e);
    }
  }

  handleLocalIceCandidate(candidate: any) {
    this.sendMessage({
      iceCandidate: candidate,
    });
  }

  addTrack(track: MediaStreamTrack) {
    this.maybeResetPeerConnection();
    // Optionally, a stream can be added here too.
    this.info(`adding ${track} to peerconnection`);
    return this.peerConnection.addTrack(track);
  }

  sendMessage(message: any) {
    this.messageBuffer.push(message);
    this.maybeFlushMessageBuffer();
  }
  maybeFlushMessageBuffer() {
    if (this.onMessage) {
      for (const message of this.messageBuffer) this.onMessage(message);
      this.messageBuffer = [];
    }
  }
}
