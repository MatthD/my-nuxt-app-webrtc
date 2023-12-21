import * as fs from "fs";
import wrtc from "wrtc";
import { resolve } from "path";
const { RTCPeerConnection, nonstandard, RTCSessionDescription } = wrtc;
const { RTCAudioSource } = nonstandard;

export default defineEventHandler(async (event) => {
  const peerConnection = new RTCPeerConnection();

  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      `ICE Connection State has changed: ${peerConnection.iceConnectionState}`
    );
  };

  const body = await readBody(event);

  const audioSource = new RTCAudioSource();
  const audioTrack = audioSource.createTrack();
  peerConnection.addTrack(audioTrack);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(body));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const response = JSON.stringify(peerConnection.localDescription);
  event.node.res.end(response);
  setTimeout(() => {
    sendAudioFile(audioSource);
  }, 10);
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function sendAudioFile(source: InstanceType<typeof RTCAudioSource>) {
  // const file = fs.createReadStream("/Users/dieudonn/Documents/ulaw.raw");
  const file = fs.createReadStream(
    resolve(process.cwd(), "./helpers/testlong.pcm")
  );
  file.on("data", (chunk: Buffer) => {
    // Here, you need to convert the raw audio data to suitable WebRTC track samples
    // This part depends on your specific audio format and how you want to handle it
    for (let i = 0; i < chunk.length - 320; i += 320) {
      const newBuffer = new Uint8Array(320);
      chunk.copy(newBuffer, 0, i, i + 320);
      const samples = new Int16Array(newBuffer.buffer);
      source.onData({
        numberOfFrames: samples.length,
        channelCount: 1,
        bitsPerSample: 16,
        samples,
        sampleRate: 16000,
      });
    }
  });
}
