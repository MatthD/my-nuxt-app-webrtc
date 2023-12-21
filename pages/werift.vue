<template>
  <h1>Test Werift page</h1>
  <div>
    <audio ref="audio" id="audio" autoplay controls playsinline />
  </div>
</template>

<script setup lang="ts">
// declare a ref to hold the element reference
// the name must match template ref value
const audio = ref();

onMounted(() => {
  console.log('mounted');
  if (audio.value) {
    console.log('mounted2');
    let pc = new RTCPeerConnection();

    pc.ontrack = function (event) {
      console.log('Track added', event, event.streams[0]?.getTracks()?.length,  event.streams[0]?.getTracks())
      audio.value.srcObject =  event.streams[0]
    }

    pc.addTransceiver("audio");

    pc.createOffer()
      .then((offer) => {
        pc.setLocalDescription(offer);

        return fetch(`/api/werift`, {
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
