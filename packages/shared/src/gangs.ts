/* Las cuatro pandillas de Buenos Aires, la policía (amenaza para todos) y la casa.
   Pertenecés a una pandilla cuando tiene la mitad o más de tu afinidad (todo lo que hiciste pesa igual). */
import { HISTORIA } from "./historia.js";
import type { Gang, Job, Mission } from "./types.js";

export const GANG_KEYS: Gang[] = ["familia", "sindicato", "barra", "amarillos"];
export const GANG_THRESHOLD = 0.5;   // con la mitad de tu afinidad, sos de esa pandilla
export const GANG_MIN_POINTS = 10;   // y al menos una misión hecha (antes de eso sos "suelto")

export interface GangInfo { name: string; boss: string; color: string; hood: string; perk: string; say: string }
export const GANGS: Record<Gang, GangInfo> = {
  familia:   { name: "La Familia", boss: "Elvira «La Señora» Santoro", color: "#e0524f", hood: "el puerto",
               perk: "+10% de plata en los golpes", say: "Pagan poco por ser honesto. Yo pago bien." },
  sindicato: { name: "El Sindicato", boss: "Don Ramón Ferrante", color: "#5b9be6", hood: "los galpones",
               perk: "Entrenás 25% más rápido (en los galpones sobran fierros)", say: "Acá se para cuando yo digo y se cobra cuando yo digo." },
  barra:     { name: "La Barra", boss: "El Tano Lucero", color: "#6cc070", hood: "la cancha",
               perk: "+10% de fuerza en las peleas", say: "El barrio se banca con el cuerpo, pibe." },
  amarillos: { name: "Los Amarillos", boss: "Rita \"Taxi\" Quiroga", color: "#f2c94c", hood: "las remiserías",
               perk: "Tu nivel de búsqueda sube 30% menos", say: "Conozco cada calle de Buenos Aires. Y cada salida." }
};

/* Rango por respeto (igual para todas las pandillas) */
export const RANK_AT: number[] = [0, 50, 220, 600, 1400, 3000];
export const RANK_NAMES = ["Perejil", "Pibe", "Soldado", "Puntero", "Lugarteniente", "Capo"];

/* Golpes: la "caza" de BiteFight para todos los pandilleros. Pagan bien, suman respeto y calor. */
export const GOLPES: Job[] = [
  { id:"celu",     name:"Arrebato de celulares",           cost:1, risk:1, gold:[8,18],    xp:[4,6],   resp:1, heat:1, lvl:1,  fail:"La víctima resultó ser profesora de karate." },
  { id:"estereo",  name:"Robar estéreos de autos",         cost:2, risk:1, gold:[18,38],   xp:[7,12],  resp:1, heat:2, lvl:3,  fail:"Se te cerró la ventanilla en la mano." },
  { id:"desarme",  name:"Laburo en el desarmadero",        cost:3, risk:2, gold:[38,75],   xp:[14,20], resp:2, heat:3, lvl:5,  fail:"Se te cayó un motor arriba del pie." },
  { id:"estacion", name:"Asalto a una estación de servicio", cost:4, risk:2, gold:[70,130], xp:[24,34], resp:3, heat:5, lvl:8,  fail:"El playero tenía un matafuegos y buena puntería." },
  { id:"contra",   name:"Contrabando en el puerto",        cost:5, risk:3, gold:[120,220], xp:[38,53], resp:4, heat:6, lvl:11, fail:"La carga se desarmó y te aplastó contra el contenedor." },
  { id:"financ",   name:"Asalto a una financiera",         cost:6, risk:3, gold:[200,360], xp:[55,74], resp:5, heat:8, lvl:15, fail:"El de seguridad no estaba dormido." },
  /* los locales de cada barrio (se hacen ahí, en el mapa) */
  { id:"r-kiosco",   name:"Robar un kiosco",                cost:2, risk:1, gold:[15,30],   xp:[6,10],  resp:1, heat:2, lvl:2,  fail:"El kiosquero tenía un bate abajo del mostrador." },
  { id:"r-mascotas", name:"Robar un pet shop",              cost:2, risk:1, gold:[16,34],   xp:[7,11],  resp:1, heat:1, lvl:3,  fail:"Un caniche te mordió el tobillo y no te soltó." },
  { id:"r-cyber",    name:"Robar un cyber",                 cost:3, risk:1, gold:[30,60],   xp:[11,17], resp:2, heat:2, lvl:4,  fail:"Los pibes del Counter dejaron de jugar y te sacaron a patadas." },
  { id:"r-farmacia", name:"Robar una farmacia",             cost:4, risk:2, gold:[60,110],  xp:[20,28], resp:2, heat:4, lvl:7,  fail:"La farmacéutica apretó el botón antipánico." },
  { id:"r-electro",  name:"Robar una casa de electrodomésticos", cost:5, risk:2, gold:[100,180], xp:[30,42], resp:3, heat:5, lvl:10, fail:"Te quedaste trabado con un lavarropas en la puerta." },
  { id:"r-joyeria",  name:"Robar una joyería",              cost:6, risk:3, gold:[180,320], xp:[48,64], resp:4, heat:7, lvl:14, fail:"La vidriera era blindada. Tu mano, no." }
];
export const VENUE_GOLPES = ["r-kiosco", "r-mascotas", "r-cyber", "r-farmacia", "r-electro", "r-joyeria"];

/* Encargos: trabajitos repetibles que cada pandilla te ofrece. Suman afinidad con esa pandilla. */
export interface Encargo { gang: Gang; name: string; stat: "fue" | "dur" | "ref" | "lab"; ok: string; ko: string }
export const ENCARGO_COST = 4, ENCARGO_AFF = 3;
export const ENCARGOS: Record<Gang, Encargo> = {
  familia:   { gang: "familia", name: "Cobrar la protección de un comercio", stat: "lab",
               ok: "El comerciante pagó sin chistar.", ko: "El comerciante llamó a sus primos. Saliste rengueando." },
  sindicato: { gang: "sindicato", name: "Apretar a un capataz", stat: "fue",
               ok: "El capataz entendió el mensaje.", ko: "El capataz tenía más amigos de los que pensabas." },
  barra:     { gang: "barra", name: "Bancar los trapos en la tribuna", stat: "dur",
               ok: "Los trapos siguen colgados. El Tano te saludó de lejos.", ko: "La hinchada visitante te pasó por arriba." },
  amarillos: { gang: "amarillos", name: "Llevar un auto \"prestado\" al desarmadero", stat: "ref",
               ok: "Llegaste antes de que alguien anotara la patente.", ko: "Chocaste a dos cuadras. El auto quedó y vos también." }
};

/* La policía: no se juega, pero persigue a todos. Con calor alto, las emboscadas son de la policía. */
export const POLICE_NAMES = ["Agente Sosa", "Cabo Ferreyra", "Sargento Paredes", "Oficial Benítez", "Subinspectora Luna", "Oficial Toledo"];

/* Pandilleros con nombre para La calle (los "otros jugadores" de BiteFight cuando no hay gente real) */
export const GANG_MEMBERS: Record<Gang, string[]> = {
  familia:   ["El Rengo Acosta", "Manco Suárez", "La Gata Ibarra", "Nene Cabral", "Pochi Villalba", "La Turca"],
  sindicato: ["Cacho Ferreyra", "\"Grúa\" Ledesma", "El Negro Paredes", "Tito Bermúdez", "El Ruso Olmedo", "Chueco Benítez"],
  barra:     ["El Pelado Godoy", "Chino Funes", "\"Bombo\" Molina", "El Polaco Toledo", "Fideo Romero", "La Colo Sosa"],
  amarillos: ["Turco Abdala", "Petiso Luna", "\"Rueda\" Gómez", "Mecha Vidal", "Pirata Arce", "La Rubia Benítez"]
};

/* Ranking: personajes fijos para que la ciudad no se vea vacía. [nombre, pandilla, respeto, nivel] */
export const RIVALS: [string, Gang, number, number][] = [
  ["Elvira «La Señora» Santoro", "familia", 2900, 26], ["Don Ramón Ferrante", "sindicato", 2500, 24], ["El Tano Lucero", "barra", 2100, 22],
  ["Rita \"Taxi\" Quiroga", "amarillos", 1800, 21], ["El Gallego", "familia", 980, 16], ["\"Grúa\" Ledesma", "sindicato", 720, 14],
  ["Chino Funes", "barra", 510, 12], ["Pirata Arce", "amarillos", 340, 10], ["La Turca", "familia", 220, 8],
  ["El Ruso Olmedo", "sindicato", 130, 6], ["Fideo Romero", "barra", 75, 5], ["Mecha Vidal", "amarillos", 10, 2]
];

/* Misiones: un hilo de tres por pandilla. Hacerlas suma mucha afinidad (10 / 20 / 40). */
export const MISSION_AFF = [10, 20, 40];

/* Las misiones de cada jefe: el modo historia (historia.ts), 15 por pandilla */
export const MISSIONS: Record<Gang, Mission[]> = HISTORIA;

/* La casa: tu base. Se mejora con plata y tiempo de obra (no te bloquea mientras se construye). */
export type HomePart = "cama" | "caja" | "armario";
export interface HomeLevel { name: string; cost: number; mins: number }
export const HOME: Record<HomePart, { title: string; help: string; levels: HomeLevel[] }> = {
  cama: { title: "Cama", help: "Más energía máxima y recuperás vida más rápido.", levels: [
    { name: "Colchón en el piso", cost: 0, mins: 0 },
    { name: "Cama de una plaza", cost: 300, mins: 10 },
    { name: "Cama de dos plazas", cost: 1500, mins: 30 },
    { name: "Sommier", cost: 5000, mins: 60 },
    { name: "Cama king con almohada de pluma", cost: 12000, mins: 180 }
  ] },
  caja: { title: "Caja fuerte", help: "La plata guardada no te la pueden robar ni sacar en una fianza.", levels: [
    { name: "Sin caja fuerte", cost: 0, mins: 0 },
    { name: "Lata de galletitas", cost: 250, mins: 5 },
    { name: "Cajita con candado", cost: 1000, mins: 20 },
    { name: "Caja fuerte de pared", cost: 3500, mins: 45 },
    { name: "Caja blindada", cost: 9000, mins: 90 },
    { name: "Bóveda", cost: 22000, mins: 180 }
  ] },
  armario: { title: "Armario", help: "Más lugar en tu bolso para guardar equipo.", levels: [
    { name: "Sin armario", cost: 0, mins: 0 },
    { name: "Perchero", cost: 200, mins: 10 },
    { name: "Ropero", cost: 1200, mins: 30 },
    { name: "Vestidor con armero", cost: 4500, mins: 90 }
  ] }
};
export const BED_ENERGY = [0, 5, 10, 15, 20];          // energía máxima extra
export const BED_HEAL = [0, 0.15, 0.3, 0.45, 0.6];     // vida que recuperás de más
export const SAFE_CAP = [0, 200, 800, 2500, 7000, 18000];
export const CLOSET_SLOTS = [0, 2, 4, 8];
