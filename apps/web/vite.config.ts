import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* En desarrollo, /api va al servidor de Node (puerto 3000) */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3000", ws: true } }
  }
});
