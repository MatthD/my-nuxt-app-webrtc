import { defineNuxtConfig } from "nuxt/config";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  watch: ["modules/socket.ts"],
  srcDir: ".",
  // watch: [".ts"],
  // ssr: false,
  // vite: {
  //   server: {
  //     watch: {
  //       usePolling: true,
  //     },
  //   },
  // },
});
