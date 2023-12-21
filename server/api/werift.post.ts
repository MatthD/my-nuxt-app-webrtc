import * as fs from "fs";
import { resolve } from "path";
import { RTCPeerConnection, RTCRtpCodecParameters, RTCRtpSender } from "werift";

export default defineEventHandler(async (event) => {
  const peerConnection = new RTCPeerConnection({
    codecs: {
      audio: [
        new RTCRtpCodecParameters({
          mimeType: "audio/opus",
          clockRate: 16000,
          channels: 1,
        }),
      ],
    },
  });

  peerConnection.connectionStateChange.subscribe((state) => {
    console.log(`ICE Connection State has changed: ${state}`);
  });

  const body = await readBody(event);

  // Ajoutez ici la logique pour gérer les tracks et les transceivers si nécessaire

  await peerConnection.setRemoteDescription(body);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const response = JSON.stringify(peerConnection.localDescription);
  event.node.res.end(response);

  setTimeout(() => {
    sendAudioFile(peerConnection);
  }, 100);
});

function sendAudioFile(peerConnection: RTCPeerConnection) {
  const file = fs.createReadStream(
    resolve(process.cwd(), "./helpers/test.pcm")
  );

  // Créer un sender pour la piste audio
  const sender = new RTCRtpSender("audio");
  const mediaStreamTrack = sender?.track;
  if (mediaStreamTrack) {
    peerConnection.addTrack(mediaStreamTrack);
  }

  file.on("data", (chunk: Buffer) => {
    sender.sendRtp(chunk);
  });
}
