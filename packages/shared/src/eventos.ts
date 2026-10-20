/* Misiones de eventos del calendario. Solo se pueden hacer mientras dura el evento (ver activeEvents en lugares.ts). */
import type { Mission } from "./types.js";

/* Noche de Brujas: alguien está saqueando las bóvedas del cementerio de Recoleta */
export const EVENT_MISSIONS: Mission[] = [
  { id: "hw-1", event: "halloween", client: "vecinos", rank: 0, mins: 15, place: "Recoleta", title: "Ruidos en las bóvedas",
    intro: "El cuidador del cementerio jura que de noche se escuchan martillazos en las bóvedas. «No son fantasmas. Los fantasmas no usan amoladora.»",
    req: { ref: 7 }, reward: { gold: 300, xp: 120, resp: 40, heat: 5 },
    steps: [
      { text: "Saltar el paredón del cementerio sin que te vea el sereno.", stat: "ref", diff: 6, energy: 2, dmg: 0.08, ok: "Caíste entre dos ángeles de mármol.", ko: "Te enganchaste el pantalón en las rejas." },
      { text: "Seguir los martillazos entre las bóvedas.", stat: "lab", diff: 6, energy: 2, dmg: 0, ok: "Encontraste la bóveda abierta: alguien la está vaciando.", ko: "Te perdiste entre pasillos que son todos iguales." },
      { text: "Un ladrón de bóvedas con máscara de calabaza te sale al cruce.", fight: { name: "El de la calabaza", mult: 0.8 }, energy: 3, win: "La calabaza sale rodando. Abajo hay un pibe asustado.", lose: "Te dio con una pala y se escapó." },
      { text: "Volver con el cuidador.", energy: 1, auto: true, ok: "El cuidador anota algo en un cuaderno viejo." }
    ],
    outro: "«Eran varios. Y uno dijo un nombre: Don Fermín. Averiguá quién es.»" },
  { id: "hw-2", event: "halloween", client: "vecinos", rank: 0, mins: 25, place: "Recoleta", title: "El anticuario de las bóvedas",
    intro: "Don Fermín tiene un anticuario y vende candelabros de bronce «de época». Muy de época. Muy de bóveda.",
    req: { lab: 9 }, reward: { gold: 600, xp: 220, resp: 70, heat: 8 },
    steps: [
      { text: "Hacerte pasar por coleccionista en el anticuario.", stat: "lab", diff: 9, energy: 2, dmg: 0, ok: "Don Fermín te muestra la trastienda.", ko: "Don Fermín no te cree: «Vos no tenés cara de coleccionista»." },
      { text: "Encontrar la lista de bóvedas que van a vaciar.", stat: "ref", diff: 9, energy: 2, dmg: 0.08, ok: "Está escrita en una servilleta: la próxima es esta noche.", ko: "Casi te agarra con las manos en el cajón." },
      { text: "Los sobrinos de Don Fermín cuidan la puerta.", fight: { name: "Los sobrinos de Don Fermín", mult: 0.85 }, energy: 3, win: "Los sobrinos quedan sentados entre candelabros.", lose: "Te sacan a la vereda de un empujón." },
      { text: "Volver con el cuidador.", energy: 1, auto: true, ok: "El cuidador cierra el cuaderno: «Esta noche los esperamos»." }
    ],
    outro: "«Esta noche vuelven. Y esta vez los esperamos.»" },
  { id: "hw-3", event: "halloween", client: "vecinos", rank: 0, mins: 40, place: "Recoleta", title: "La noche de las calabazas",
    intro: "Medianoche en el cementerio. Diez máscaras de calabaza, una camioneta y un cuidador con linterna.",
    req: { fue: 11, dur: 10 }, reward: { gold: 1200, xp: 400, resp: 150, heat: 12 }, prize: "calabaza",
    steps: [
      { text: "Esperar escondido toda la noche entre las bóvedas.", stat: "dur", diff: 11, energy: 3, dmg: 0.1, ok: "Aguantaste el frío y el miedo.", ko: "Te dormiste apoyado en una lápida." },
      { text: "Cerrarles el paso a la camioneta en el portón.", stat: "fue", diff: 11, energy: 3, dmg: 0.1, ok: "El portón queda trabado con una cadena.", ko: "La camioneta pasa rozándote." },
      { text: "Don Fermín en persona, con la máscara de calabaza más grande.", fight: { name: "Don Fermín", mult: 0.95 }, energy: 4, win: "Don Fermín queda atado a un ángel de mármol. Su máscara es tuya.", lose: "Don Fermín se escapa entre la niebla." },
      { text: "Volver con el cuidador.", energy: 1, auto: true, ok: "El cuidador sonríe por primera vez en años." }
    ],
    outro: "«Las bóvedas descansan en paz. Y vos te llevás un recuerdo.»" }
];
