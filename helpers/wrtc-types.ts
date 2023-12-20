/**
 * webrtc signaling between frontend to backend
 * Used for negotiating WebRTC connection. Only one of `answer`, `offer`, `iceCandidate` can be present.
 */
export interface Webrtc {
  type: "webrtc";
  /**
   * WebRTC offer. Cannot be included if answer is present.
   */
  offer?: WebrtcNegotiationOffer;
  /**
   * WebRTC answer. Cannot be included if offer is present.
   */
  answer?: WebrtcNegotiationAnswer;
  /**
   * ICE Candidate for WebRTC connection
   */
  iceCandidate?: WebrtcNegotiationIceCandidate;
}
/**
 * WebRTC Answer
 * WebRTC answer. Cannot be included if offer is present.
 */
export interface WebrtcNegotiationAnswer {
  type: "answer";
  /**
   * SDP descriptor for the answer
   */
  sdp: string;
}
/**
 * WebRTC ICE Candidate
 * ICE Candidate for WebRTC connection.
 * See https://w3c.github.io/webrtc-pc/#rtcicecandidate-interface
 */
export interface WebrtcNegotiationIceCandidate {
  [name: string]: any;
}
/**
 * WebRTC Offer
 * WebRTC offer. Cannot be included if answer is present.
 */
export interface WebrtcNegotiationOffer {
  type: "offer";
  /**
   * SDP descriptor for the offer
   */
  sdp: string;
}
/**
 * TURN Credentials
 * TURN Credentials to be used for webRTC connections. These will be passed to the clients when they connect to the backend, but will also be used by the backend to connect to the TURN servers.
 */
export interface TurnCredentials {
  /**
   * A temporary username used to authenticate to our TURN servers
   */
  username: string;
  /**
   * A credential used to authenticate to our TURN servers
   */
  credential: string;
  urls: string[];
}
