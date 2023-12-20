import { WebSocketServer } from "ws";
import { defineNuxtModule } from "@nuxt/kit";
import { WebRTCManager } from "../helpers/webrtc";
import { Webrtc } from "../helpers/wrtc-types";
import * as fs from "fs";
import { resolve } from "path";

export default defineNuxtModule({
  setup(options, nuxt) {
    const audioData = fs.readFileSync(
      resolve(__dirname, "../helpers/test.pcm")
    );
    nuxt.hook("listen", (server) => {
      const wss = new WebSocketServer({ server });
      nuxt.hook("close", () => wss.close());
      wss.on("connection", (ws) => {
        const wrtcManager = new WebRTCManager(false, [
          {
            urls: ["turn:global.turn.twilio.com:3478?transport=udp"],
            username:
              "5e4b8fdd2c64c7358f68793f0ea299d600cfd69dd554368d037cae816f80c57d",
            credential: "S7QKK4/Cjochki4K8E/F2vHKuzF1ucB06tJNWaJT7YQ=",
          },
          {
            urls: ["turn:global.turn.twilio.com:3478?transport=tcp"],
            username:
              "5e4b8fdd2c64c7358f68793f0ea299d600cfd69dd554368d037cae816f80c57d",
            credential: "S7QKK4/Cjochki4K8E/F2vHKuzF1ucB06tJNWaJT7YQ=",
          },
          {
            urls: ["turn:global.turn.twilio.com:443?transport=tcp"],
            username:
              "5e4b8fdd2c64c7358f68793f0ea299d600cfd69dd554368d037cae816f80c57d",
            credential: "S7QKK4/Cjochki4K8E/F2vHKuzF1ucB06tJNWaJT7YQ=",
          },
        ]);

        wrtcManager.initialize((message: any) => {
          console.log("Should now send message to front", message);
          ws.send(JSON.stringify(message));
        });

        ws.on("close", () => {
          console.log("WebSocket closed");
          wrtcManager.destructor();
        });

        console.log("connected");
        ws.onmessage = ({ data }: any) => {
          const message = JSON.parse(data);
          if (message.ice || message.offer || message.answer) {
            wrtcManager
              .handleV1Message(data as Webrtc)
              .catch((e) => console.log("error in wrtc signalling: ", e));
          } else {
            console.log("unexpected message");
          }
        };

        const sampleRate = 16000;

        const { rtcAudioSource, rtcAudioTrack } =
          wrtcManager.createAudioSourceAndTrack();
        wrtcManager.addTrack(rtcAudioTrack);
        console.log({ audioData: audioData.length });

        setInterval(() => {
          for (let i = 0; i < audioData.length - 320; i += 320) {
            const newBuffer = new Uint8Array(320);
            audioData.copy(newBuffer, 0, i, i + 320);
            const samples = new Int16Array(newBuffer.buffer);
            console.log("sample", samples.length, samples.byteLength);
            const data = {
              samples,
              sampleRate,
              bitsPerSample: 16,
              channelCount: 1,
            };
            rtcAudioSource.onData(data);
          }
        }, 2100);
        setTimeout(() => {
          // clearInterval(interval);
          console.log("end interval");
        }, 60000);
      });
    });
  },
});
