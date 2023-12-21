import * as fs from "fs";
import wrtc from "wrtc";
import { resolve } from "path";
import { Readable } from "stream";
const { RTCPeerConnection, nonstandard, RTCSessionDescription } = wrtc;
import { defer } from "lodash";
// const { RTCAudioSource } = nonstandard;

export default defineEventHandler(async (event) => {
  const peerConnection = new RTCPeerConnection();

  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      `ICE Connection State has changed: ${peerConnection.iceConnectionState}`
    );
  };

  const body = await readBody(event);

  const audioSource = new NodeWebRtcAudioStreamSource();
  const file = fs.createReadStream(
    resolve(process.cwd(), "./helpers/openai-alloy-fr.raw")
  );
  audioSource.addStream(file, 16, 24000, 1);
  const audioTrack = audioSource.createTrack();
  peerConnection.addTrack(audioTrack);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(body));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const response = JSON.stringify(peerConnection.localDescription);
  event.node.res.end(response);
  // setTimeout(() => {
  //   sendAudioFile(audioSource);
  // }, 10);
});

// class NodeWebRtcAudioStreamSource extends wrtc.nonstandard.RTCAudioSource {
//   addStream(
//     readable: Readable,
//     bitsPerSample = 16,
//     sampleRate = 16000,
//     channelCount = 1
//   ) {
//     let cache = Buffer.alloc(0);
//     let streamEnd = false;
//     readable.on("data", (buffer) => {
//       cache = Buffer.concat([cache, buffer]);
//     });

//     readable.on("end", () => {
//       streamEnd = true;
//     });

//     const processData = () => {
//       const byteLength =
//         ((sampleRate * bitsPerSample) / 8 / 100) * channelCount; // node-webrtc audio by default every 10ms, it is 1/100 second
//       if (cache.length >= byteLength || streamEnd) {
//         const buffer = cache.slice(0, byteLength);
//         cache = cache.slice(byteLength);
//         const samples = new Int16Array(new Uint8Array(buffer).buffer);
//         this.onData({
//           bitsPerSample: 16,
//           sampleRate,
//           channelCount: 1,
//           numberOfFrames: samples.length,
//           samples,
//         });
//       }
//       if (!streamEnd || cache.length >= byteLength) {
//         setTimeout(() => processData(), 9.8); // every 10 ms, required by node-webrtc audio
//       }
//     };
//     processData();
//   }
// }

// function sendAudioFile(source: InstanceType<typeof RTCAudioSource>) {
//   // const file = fs.createReadStream("/Users/dieudonn/Documents/ulaw.raw");
//   const file = fs.createReadStream(
//     resolve(process.cwd(), "./helpers/testlong.pcm")
//   );
//   file.on("data", (chunk: Buffer) => {
//     // Here, you need to convert the raw audio data to suitable WebRTC track samples
//     // This part depends on your specific audio format and how you want to handle it
//     for (let i = 0; i < chunk.length - 320; i += 320) {
//       const newBuffer = new Uint8Array(320);
//       chunk.copy(newBuffer, 0, i, i + 320);
//       const samples = new Int16Array(newBuffer.buffer);
//       source.onData({
//         numberOfFrames: samples.length,
//         channelCount: 1,
//         bitsPerSample: 16,
//         samples,
//         sampleRate: 16000,
//       });
//     }
//   });
// }

class NodeWebRtcAudioStreamSource extends wrtc.nonstandard.RTCAudioSource {
  private startTs: number = 0;
  private audioSentMs = 0;
  addStream(
    readable: Readable,
    bitsPerSample: number,
    sampleRate: number,
    channelCount: number
  ) {
    let cache = Buffer.alloc(0);
    let streamEnd = false;
    readable.on("data", (buffer) => {
      cache = Buffer.concat([cache, buffer]);
    });

    readable.on("end", () => {
      streamEnd = true;
    });

    const processData = () => {
      if (!this.startTs) {
        this.startTs = Date.now();
      }
      const byteLength =
        ((sampleRate * bitsPerSample) / 8 / 100) * channelCount; // node-webrtc audio by default every 10ms, it is 1/100 second
      if (cache.length >= byteLength || streamEnd) {
        const buffer = cache.slice(0, byteLength);
        cache = cache.slice(byteLength);
        const samples = new Int16Array(new Uint8Array(buffer).buffer);
        this.onData({
          bitsPerSample: 16,
          sampleRate,
          channelCount: 1,
          numberOfFrames: samples.length,
          samples,
        });
        this.audioSentMs += 10; // TODO: compute from params
      } else {
        this.startTs = 0;
        this.audioSentMs = 0;
        // TODO: make sure we wake up again on data instead of busy waiting
      }
      const EPSILON = 1;
      if (!streamEnd || cache.length >= byteLength) {
        //cache.length >= byteLength) { // what if currently cache.length === 0 but we receive more data before next callback
        /** this is the absolute timestamp at which, under perfect conditions, we'll send the *next* chunk of audio */
        const timeWeShouldSendNextData = this.startTs + this.audioSentMs + 10;
        /* should *on average* work out to exactly 10ms */
        const timeToWaitMs = Math.max(
          0,
          timeWeShouldSendNextData - Date.now() - EPSILON
        );
        setTimeout(() => processData(), timeToWaitMs); // every 10 ms, required by node-webrtc audio
      }
    };
    processData();
  }
}
