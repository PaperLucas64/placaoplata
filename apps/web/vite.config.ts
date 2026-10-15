import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* En desarrollo, /api va al servidor de Node (puerto 3000).
   Al publicar, VITE_API_URL es la dirección del servidor
   si vive en otro lado (p. ej. https://api.cinectomia.com). Sin VITE_API_URL, usa el mismo sitio. */
export default defineConfig({
  base: process.env.VITE_BASE ?? "./", // rutas relativas: funciona en cualquier carpeta (cinectomia.com/juego/)
  plugins: [react()],
  worker: { format: "es" }, // el worker del mapa (MapLibre 6) es un módulo
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3000", ws: true } }
  }
});
