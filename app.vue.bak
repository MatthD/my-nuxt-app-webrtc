<template>
  <div>
    <NuxtWelcome />
    <figure>
      <figcaption>Listen to the T-Rex:</figcaption>
      <button @click="handlerClick">click</button>
      <audio id="audio" controls>
        <a> Download audio </a>
      </audio>
    </figure>
  </div>
</template>

<script lang="ts" setup>
function handlerClick(){
  console.log('We should now initiate everything')
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
  let peer: RTCPeerConnection;
  ws.onopen = async () => {
    console.log("WebSocket connected");
    peer = new RTCPeerConnection();

    peer.addTransceiver("audio");
    ws.onmessage = async ({ data }: any) => {
      // console.log("message recevied,", { data });
      const message = JSON.parse(data);
      if (message.ice) {
        await peer.addIceCandidate(message.ice);
      } else if (message.offer) {
        await peer.setRemoteDescription(
          new RTCSessionDescription(message.offer)
        );
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        console.log("set local description");
        ws.send(JSON.stringify({ answer }));
      } else if (message.answer) {
        await peer.setRemoteDescription(
          new RTCSessionDescription(message.answer)
        );
        console.log("set remote description");
      }
      peer.addEventListener("track", (event) => {
        //@ts-ignore
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("We received a track now", event);
        // Get the audio element
        const audioElement = document.getElementById("audio")!;

        // Set the MediaStream as the source of the audio element
        //@ts-ignore
        const mediaStream = new MediaStream([event.track]);
        //@ts-ignore
        audioElement.srcObject = mediaStream;
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);


        // Connect the sourceNode to the AudioContext's destination (e.g., speakers)
        sourceNode.connect(audioContext.destination);


        //@ts-ignore
        // audioElement.play()
        //   .then(() => {
        //     console.log("Audio is playing");
        //   })
        //   .catch((error: any) => {
        //     console.error("Error playing audio:", error);
        //   });
      });
    };
  };
  ws.onclose = () => {
    console.log("WebSocket closed");
    // Close the peer connection here
    peer.close();
  };
}
let ws: WebSocket;
onMounted(() => {
  console.log("mounted");

  
});
</script>
