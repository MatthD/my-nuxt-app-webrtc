<template>
  <div>
    <NuxtWelcome />
  </div>
</template>

<script lang="ts" setup>
let ws: WebSocket;
onMounted(() => {
  console.log("mounted");

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
  ws.onopen = async () => {
    console.log("connected")
    const peer = new RTCPeerConnection();
    const localOffer = await peer.createOffer();
    await peer.setLocalDescription(localOffer);
    console.log('set local description');
    ws.onmessage = async ({data}: any) => {
      const offer = JSON.parse(data);
      await peer.setRemoteDescription(offer);
      console.log({offer});
      const audioData = peer.addTransceiver('audio');
      peer.ontrack = (e=>{
        console.log({e})
      })
      console.log({audioData})
    };
  };
});
</script>
