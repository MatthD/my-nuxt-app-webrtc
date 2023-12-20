import { WebSocketServer } from "ws";
import { defineNuxtModule } from "@nuxt/kit";
import wrtc from "wrtc";

export default defineNuxtModule({
  setup(options, nuxt) {
    nuxt.hook("listen", (server) => {
      const wss = new WebSocketServer({ server });
      nuxt.hook("close", () => wss.close());
      wss.on("connection", async (ws) => {
        console.log("connected");
        const pc = new wrtc.RTCPeerConnection() as RTCPeerConnection;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify(offer));
        const source = new wrtc.nonstandard.RTCAudioSource();
        const track = source.createTrack();
        console.log({ track, source });

        const sampleRate = 8000;
        const samples = new Int16Array(sampleRate / 100); // 10 ms of 16-bit mono audio
        const data = {
          samples,
          sampleRate,
        };

        const interval = setInterval(() => {
          source.onData(data);
        });
        setTimeout(() => {
          clearInterval(interval);
          track.stop();
          console.log("end interval");
        }, 10000);
      });
    });
  },
});
