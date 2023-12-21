<template>
  <h1>Test page</h1>
  <div>
    <audio ref="audio" id="audio" autoplay controls playsinline />
  </div>
</template>

<script setup lang="ts">
const audio = ref();

onMounted(() => {
  console.log('mounted');
  const audioStream = new MediaStream(); // this was the solution ! https://stackoverflow.com/questions/58573208/why-is-the-mediastream-object-in-this-case-empty#comment107645864_58573208
  if (audio.value) {
    console.log('mounted2');
    let pc = new RTCPeerConnection();

    pc.ontrack = function (event) {
      console.log('Track added', event, event.streams[0]?.getTracks()?.length,  event.streams[0]?.getTracks())
      audioStream.addTrack(event.track);
      audio.value.srcObject = audioStream
    }

    pc.addTransceiver("audio");

    pc.createOffer()
      .then((offer) => {
        pc.setLocalDescription(offer);

        return fetch(`/api/signaling`, {
          method: "post",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(offer),
        });
      })
      .then((res) => res.json())
      .then((res) => pc.setRemoteDescription(res))
      .catch(alert);
  }
});
</script>
