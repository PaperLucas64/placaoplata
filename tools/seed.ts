/* Crea jugadores de prueba (Cabo Prueba, Agente Test, Rata Prueba, Turca Test; contraseña prueba123).
   Uso: con `npm run dev` andando, en otra terminal: npm run seed
   Lo hace el servidor mismo, así nunca hay dos procesos tocando la base local a la vez. */
const res = await fetch("http://127.0.0.1:3000/api/dev/seed", { method: "POST" }).catch(() => null);
if (!res) { console.error("No encontré el servidor. Primero corré `npm run dev`."); process.exit(1); }
const { created, error } = await res.json();
if (error) { console.error(error); process.exit(1); }
console.log(created.length ? created.map((c: string) => `creado: ${c}`).join("\n") : "Los jugadores de prueba ya existían.");
