import { defineNuxtConfig } from "nuxt/config";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  // ssr: false,
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
