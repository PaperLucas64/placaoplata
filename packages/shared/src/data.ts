/* Datos del juego: trabajos, rivales, ítems, misiones y rangos.
   Se comparten entre el servidor, la pantalla y el simulador de balance. */
import type { Slot, Job, RingRival, Item, Mission, StatKey, TabKey, PlayerState } from "./types.js";

export const STAT_NAMES: Record<StatKey, string> = { fue:"Fuerza", dur:"Dureza", ref:"Reflejos", agu:"Aguante", lab:"Labia" };
export const STAT_HELP: Record<StatKey, string> = { fue:"Pegás más fuerte", dur:"Te duelen menos los golpes", ref:"Acertás más y esquivás", agu:"Más vida", lab:"Mejor paga y convencés a la gente" };

/* Laburos: la "caza" de BiteFight, en versión neutral */
export const JOBS: Job[] = [
  { id:"bici",    name:"Repartir pedidos en bici",       cost:1, risk:1, gold:[4,10],   xp:[2,4],   lvl:1, fail:"Un auto te encerró en la avenida y terminaste en el piso." },
  { id:"lavado",  name:"Lavar autos en la estación",     cost:2, risk:1, gold:[10,22],  xp:[5,8],   lvl:2, fail:"Te resbalaste con la espuma y te diste contra el surtidor." },
  { id:"puerta",  name:"Cuidar la puerta de un boliche", cost:3, risk:2, gold:[22,45],  xp:[10,15], lvl:4, fail:"Uno no quería hacer la fila y te tiró una piña." },
  { id:"chofer",  name:"Chofer de noche",                cost:4, risk:2, gold:[45,90],  xp:[18,26], lvl:6, fail:"El pasajero se bajó sin pagar y encima te empujó." },
  { id:"deposito",name:"Seguridad en un depósito del puerto", cost:5, risk:3, gold:[90,170], xp:[30,45], lvl:9, fail:"Entraron a robar y vos estabas en el medio." }
];
/* Ring: la "gruta" de BiteFight. Rivales del gimnasio de boxeo. */
export const RING: RingRival[] = [
  { name:"Sparring del gimnasio", lvl:1,  mult:.6,  lore:"Lleva casco y guantes de 16 onzas. Ideal para empezar." },
  { name:"El Toro Medina",        lvl:3,  mult:.8, lore:"Pega como un camión, pero se cansa en el tercer round." },
  { name:"La Zurda Paz",          lvl:5,  mult:0.9, lore:"Nunca sabés de qué lado viene." },
  { name:"Kid Cemento",           lvl:8,  mult:0.95, lore:"Dicen que nunca lo tiraron." },
  { name:"El campeón del barrio", lvl:12, mult:1.05, lore:"Tiene el cinturón colgado en la panadería de la esquina." }
];
export const SHOP: Item[] = [
  { id:"llave",    slot:"blanca",    name:"Llave inglesa",        val:3,  price:30,   lvl:1, bonus:{ fue: 2 } },
  { id:"bate",     slot:"blanca",    name:"Bate de aluminio",     val:5,  price:150,  lvl:3, bonus:{ fue: 3 } },
  { id:"baston",   slot:"blanca",    name:"Bastón extensible",    val:7,  price:350,  lvl:6, bonus:{ fue: 4 } },
  { id:"revolver", slot:"fuego",     name:"Revólver 38 viejo",    val:5,  price:450,  lvl:6, bonus:{ fue: 3 } },
  { id:"pistola",  slot:"fuego",     name:"Pistola 9 mm",         val:8,  price:1000, lvl:10, bonus:{ fue: 5 } },
  { id:"campera",  slot:"ropa",      name:"Campera de cuero",     val:2,  price:25,   lvl:1, bonus:{ dur: 3 } },
  { id:"gorra",    slot:"cabeza",    name:"Gorra con visera",     val:1,  price:40,   lvl:2, bonus:{ ref: 1 } },
  { id:"casco",    slot:"cabeza",    name:"Casco de moto",        val:3,  price:180,  lvl:3, bonus:{ dur: 4 } },
  { id:"chaleco",  slot:"torso",     name:"Chaleco acolchado",    val:4,  price:350,  lvl:6, bonus:{ dur: 6 } },
  { id:"botiquin", slot:"consumible",name:"Botiquín (+50% vida)", val:.5, price:20,   lvl:1 },
  /* vida para siempre: cara y cada vez más cara (ver supplementCost) */
  { id:"suplemento", slot:"consumible",name:"Suplemento de Don Tito (+10 de vida máxima, para siempre)", val:10, price:300, lvl:3 }
];

/* La primera misión de verdad, al estilo GTA: varias etapas, cada una prueba un atributo */
export const VALIJA: Mission = {
  id:"valija", rank:0, title:"La valija",
  intro:"Marga te da una dirección del puerto y un papel firmado. «Retirá una valija y traémela. No la abras. No hables con nadie.»",
  steps:[
    { text:"Retirar la valija en el depósito del puerto. El encargado no se la da a cualquiera.", stat:"lab", diff:4, energy:2, dmg:0,
      ok:"Le mostraste el papel, le hablaste del tiempo y de fútbol. Te dio la valija sin preguntar más.", ko:"No te creyó y te pidió que vuelvas con otra cara." },
    { text:"Cruzar la ciudad en hora pico. Hay un control en la avenida y la valija pesa como un muerto.", stat:"ref", diff:4, energy:2, dmg:.1,
      ok:"Doblaste justo antes del control, por una calle que nadie usa.", ko:"Te metiste en un embotellamiento, bajaste corriendo y te llevaste por delante un poste." },
    { text:"Dos tipos te vienen siguiendo desde el puerto. En un pasaje sin salida te cierran el paso.", fight:{ name:"Los dos del puerto", mult:.75 }, energy:3,
      win:"Los dos salieron corriendo. La valija sigue con vos.", lose:"Te tiraron al piso, pero no soltaste la valija. Vas a tener que volver a pasar por ese pasaje." },
    { text:"Entregar la valija en el bar de Marga.", energy:1, auto:true,
      ok:"Llegaste. Marga deja la valija sobre la barra y la abre delante tuyo." }
  ],
  outro:"La valija está vacía. Marga se ríe. «Era una prueba. Y la pasaste. Ahora las cuatro pandillas de Maires saben quién sos. Cada una te va a ofrecer trabajo: la que más te banque te va a reclamar.»"
};

/* Mercado negro: arma y protección por rango, iguales para todas las pandillas.
   Precio: ~2 sesiones de trabajo del nivel en que se llega al rango. */
SHOP.push(
  { id:"manopla",   slot:"blanca", name:"Manopla de bronce",           val:7,  price:550,  lvl:1, rank:1, bonus:{ fue: 4 } },
  { id:"gruesa",    slot:"ropa",   name:"Campera de cuero gruesa",     val:5,  price:500,  lvl:1, rank:1, bonus:{ dur: 7 } },
  { id:"navaja",    slot:"blanca", name:"Navaja automática",           val:9,  price:1300, lvl:1, rank:2, bonus:{ fue: 6 } },
  { id:"placas",    slot:"ropa",   name:"Campera con placas",          val:7,  price:1200, lvl:1, rank:2, bonus:{ dur: 10 } },
  { id:"antidisturbios", slot:"cabeza", name:"Casco antidisturbios",   val:5,  price:1000, lvl:1, rank:2, bonus:{ dur: 7 } },
  { id:"recortada", slot:"fuego",  name:"Escopeta recortada",          val:11, price:2200, lvl:1, rank:3, bonus:{ fue: 7 } },
  { id:"robado",    slot:"torso",  name:"Chaleco robado a la policía", val:8,  price:1800, lvl:1, rank:3, bonus:{ dur: 11 } },
  { id:"fusil",     slot:"fuego",  name:"Fusil del contrabando",       val:14, price:3600, lvl:1, rank:4, bonus:{ fue: 9 } },
  { id:"calabaza",  slot:"cabeza", name:"Máscara de calabaza",         val:4,  price:1000, lvl:1, event:"halloween", bonus:{ ref: 2, dur: 2 } },
  { id:"negro",     slot:"torso",  name:"Chaleco del mercado negro",   val:11, price:2900, lvl:1, rank:4, bonus:{ dur: 15 } }
);
/* nombres de cada lugar del equipo */
export const SLOT_NAMES: Record<Slot, string> = { blanca: "Arma blanca", fuego: "Arma de fuego", cabeza: "Cabeza", torso: "Chaleco", ropa: "Ropa" };
export const SLOTS: Slot[] = ["blanca", "fuego", "cabeza", "torso", "ropa"];
export const ATTACK_SLOTS: Slot[] = ["blanca", "fuego"];
/* de qué lugar es cada cosa de la versión de dos lugares (arma y armadura) */
export const OLD_SLOT: Record<string, Slot> = {
  llave: "blanca", bate: "blanca", baston: "blanca", manopla: "blanca", navaja: "blanca", recortada: "fuego", fusil: "fuego",
  campera: "ropa", gruesa: "ropa", placas: "ropa", casco: "cabeza", chaleco: "torso", robado: "torso", negro: "torso"
};
/* Equipo de la versión con policía, para pasar partidas viejas */
export const OLD_ITEMS: Record<string, string> = {
  tonfa: "manopla", reglam: "gruesa", taser: "navaja", antibalas: "placas", pistola: "recortada", tactico: "robado", antimotin: "fusil", escudo: "negro"
};

/* Tutorial: cada encargo de Marga destraba una pestaña nueva */
export interface TutStep {
  id: string; tab: TabKey; title: string; say: string;
  goal: (s: PlayerState) => boolean; prog: (s: PlayerState) => string; reward: { gold: number; xp: number };
}
export const TUT: TutStep[] = [
  { id:"t1", tab:"laburos",  title:"Recién llegado",
    say:"Si te vas a quedar en Maires, necesitás plata. Agarrá un par de laburos. Cada uno gasta energía, que se recarga sola.",
    goal:s=>s.c.jobs>=2, prog:s=>`Laburos hechos: ${Math.min(s.c.jobs,2)} de 2`, reward:{gold:15,xp:6} },
  { id:"t2", tab:"gimnasio", title:"Ponerse en forma",
    say:"Así como estás no durás una semana. En el gimnasio de Don Tito pagás y entrenás; lleva unos minutos, pero vale la pena. Subí cualquier atributo.",
    goal:s=>s.c.train>=1, prog:s=>`Atributos entrenados: ${Math.min(s.c.train,1)} de 1`, reward:{gold:20,xp:6} },
  { id:"t3", tab:"feria",    title:"Algo para defenderte",
    say:"La calle no perdona. En la feria de usados conseguís algo para pegar o algo para que no te peguen. Comprá una cosa.",
    goal:s=>s.c.buy>=1, prog:s=>`Compras: ${Math.min(s.c.buy,1)} de 1`, reward:{gold:20,xp:8} },
  { id:"t4", tab:"ring",     title:"Primer round",
    say:"Abajo del gimnasio hay un ring. Ahí aprendés a pelear sin que nadie termine preso. Ganale al sparring.",
    goal:s=>s.c.spar>=1, prog:s=>`Peleas ganadas: ${Math.min(s.c.spar,1)} de 1`, reward:{gold:25,xp:10} },
  { id:"t5", tab:"guardia",  title:"Puntos y gasas",
    say:"Te dejaron la cara como un mapa. En la clínica te curan al toque si pagás; en la guardia del hospital es gratis, pero te comés la espera. Si estás entero, pasá igual a conocerlas.",
    goal:s=>s.c.heal>=1 || !!s.seenTab.guardia, prog:()=>`Visitar la clínica`, reward:{gold:10,xp:6} },
  { id:"t6", tab:"misiones", title:"Un encargo de confianza",
    say:"Ahora sí. Tengo un trabajo de verdad para vos. Fijate en la pestaña Misiones. Son varias partes y cada una pide algo distinto.",
    goal:s=>s.c.valija>=1, prog:s=>`Misión «La valija»: ${s.busy?.kind === "mision" ? `en curso (etapa ${s.busy.done + 1} de ${VALIJA.steps.length})` : "sin empezar"}`, reward:{gold:40,xp:15} }
];
export const TAB_NAMES: Record<TabKey, string> = { laburos:"Trabajos", gimnasio:"Gimnasio", feria:"Mercado", ring:"Ring", guardia:"Clínica", misiones:"Misiones", calle:"La calle", casa:"Casa", negocios:"Negocios", amigos:"Amigos", ranking:"Ciudad", equipo:"Equipo" };
