/* Datos del juego: trabajos, rivales, ítems, misiones y rangos.
   Se comparten entre el servidor, la pantalla y el simulador de balance. */
import type { Job, RingRival, Item, Mission, Side, StatKey, TabKey, PlayerState } from "./types.js";

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
  { name:"El Toro Medina",        lvl:3,  mult:.85, lore:"Pega como un camión, pero se cansa en el tercer round." },
  { name:"La Zurda Paz",          lvl:5,  mult:1.0, lore:"Nunca sabés de qué lado viene." },
  { name:"Kid Cemento",           lvl:8,  mult:1.2, lore:"Dicen que nunca lo tiraron." },
  { name:"El campeón del barrio", lvl:12, mult:1.5, lore:"Tiene el cinturón colgado en la panadería de la esquina." }
];
export const SHOP: Item[] = [
  { id:"llave",    slot:"arma",      name:"Llave inglesa",        val:3,  price:30,   lvl:1 },
  { id:"bate",     slot:"arma",      name:"Bate de aluminio",     val:7,  price:180,  lvl:3 },
  { id:"baston",   slot:"arma",      name:"Bastón extensible",    val:13, price:650,  lvl:6 },
  { id:"campera",  slot:"armadura",  name:"Campera de cuero",     val:2,  price:25,   lvl:1 },
  { id:"casco",    slot:"armadura",  name:"Casco de moto",        val:6,  price:200,  lvl:3 },
  { id:"chaleco",  slot:"armadura",  name:"Chaleco acolchado",    val:11, price:700,  lvl:6 },
  { id:"botiquin", slot:"consumible",name:"Botiquín (+50% vida)", val:.5, price:20,   lvl:1 }
];

/* La primera misión de verdad, al estilo GTA: varias etapas, cada una prueba un atributo */
export const VALIJA: Mission = {
  id:"valija", rank:0, title:"La valija",
  intro:"Marga te da una dirección del puerto y un papel firmado. «Retirá una valija y traémela. No la abras. No hables con nadie.»",
  steps:[
    { text:"Retirar la valija en el depósito del puerto. El encargado no se la da a cualquiera.", stat:"lab", diff:5, energy:2, dmg:0,
      ok:"Le mostraste el papel, le hablaste del tiempo y de fútbol. Te dio la valija sin preguntar más.", ko:"No te creyó y te pidió que vuelvas con otra cara." },
    { text:"Cruzar la ciudad en hora pico. Hay un control en la avenida y la valija pesa como un muerto.", stat:"ref", diff:6, energy:2, dmg:.1,
      ok:"Doblaste justo antes del control, por una calle que nadie usa.", ko:"Te metiste en un embotellamiento, bajaste corriendo y te llevaste por delante un poste." },
    { text:"Dos tipos te vienen siguiendo desde el puerto. En un pasaje sin salida te cierran el paso.", fight:{ name:"Los dos del puerto", mult:.9 }, energy:3,
      win:"Los dos salieron corriendo. La valija sigue con vos.", lose:"Te tiraron al piso, pero no soltaste la valija. Vas a tener que volver a pasar por ese pasaje." },
    { text:"Entregar la valija en el bar de Marga.", energy:1, auto:true,
      ok:"Llegaste. Marga deja la valija sobre la barra y la abre delante tuyo." }
  ],
  outro:"La valija está vacía. Marga se ríe. «Era una prueba. Y la pasaste. Hay dos personas afuera que quieren hablar con vos.»"
};

/* ---------- parte 2: cada bando ---------- */
export const RANK_AT: number[] = [0,40,120,300,700,1500];
export const RANKS: Record<Side, string[]> = {
  placa:["Agente","Cabo","Sargento","Subinspector","Inspector","Comisario"],
  plata:["Campana","Soldadito","Puntero","Lugarteniente","Mano derecha","Capo"]
};


/* Patrullaje y golpes: la caza de BiteFight para cada bando.
   La placa cobra menos pero tiene sueldo; la plata cobra más pero junta calor y la pueden agarrar. */
export const SIDE_JOBS: Record<Side, Job[]> = {
  placa:[
    { id:"esquina",  name:"Parada en la esquina",            cost:1, risk:1, gold:[5,12],    xp:[4,6],   resp:1, lvl:1,  fail:"Un borracho te vomitó los zapatos y encima te empujó." },
    { id:"control",  name:"Control vehicular",               cost:2, risk:1, gold:[12,26],   xp:[8,12],  resp:1, lvl:3,  fail:"Uno sin registro aceleró y te pasó por arriba del pie." },
    { id:"centro",   name:"Patrullaje en el centro",         cost:3, risk:2, gold:[25,50],   xp:[14,20], resp:2, lvl:5,  fail:"Quisiste separar una pelea y te llevaste la peor parte." },
    { id:"cancha",   name:"Operativo en la cancha",          cost:4, risk:2, gold:[45,90],   xp:[24,34], resp:3, lvl:8,  fail:"Volaron piedras desde la tribuna visitante." },
    { id:"ruta",     name:"Persecución en la ruta",          cost:5, risk:3, gold:[80,150],  xp:[38,52], resp:4, lvl:11, fail:"El auto que perseguías frenó de golpe y te lo comiste." },
    { id:"penal",    name:"Traslado de presos al penal",     cost:6, risk:3, gold:[130,240], xp:[55,75], resp:5, lvl:15, fail:"Un preso se soltó las esposas en el camino." }
  ],
  plata:[
    { id:"celu",     name:"Arrebato de celulares",           cost:1, risk:1, gold:[8,18],    xp:[3,5],   resp:1, heat:3,  lvl:1,  fail:"La víctima resultó ser profesora de karate." },
    { id:"estereo",  name:"Robar estéreos de autos",         cost:2, risk:1, gold:[18,38],   xp:[6,10],  resp:1, heat:4,  lvl:3,  fail:"Se te cerró la ventanilla en la mano." },
    { id:"desarme",  name:"Laburo en el desarmadero",        cost:3, risk:2, gold:[38,75],   xp:[12,17], resp:2, heat:5,  lvl:5,  fail:"Se te cayó un motor arriba del pie." },
    { id:"estacion", name:"Asalto a una estación de servicio", cost:4, risk:2, gold:[70,130], xp:[20,28], resp:3, heat:8,  lvl:8,  fail:"El playero tenía un matafuegos y buena puntería." },
    { id:"contra",   name:"Contrabando en el puerto",        cost:5, risk:3, gold:[120,220], xp:[32,44], resp:4, heat:10, lvl:11, fail:"La carga se desarmó y te aplastó contra el contenedor." },
    { id:"financ",   name:"Asalto a una financiera",         cost:6, risk:3, gold:[200,360], xp:[46,62], resp:5, heat:14, lvl:15, fail:"El de seguridad no estaba dormido." }
  ]
};
/* Armería de la comisaría y mercado negro: se suman a la feria según el bando y piden rango */
SHOP.push(
  { id:"tonfa",     side:"placa", slot:"arma",     name:"Tonfa reglamentaria",       val:10, price:420,  lvl:1, rank:1 },
  { id:"antibalas", side:"placa", slot:"armadura", name:"Chaleco antibalas",         val:16, price:1500, lvl:1, rank:2 },
  { id:"pistola",   side:"placa", slot:"arma",     name:"Pistola reglamentaria",     val:20, price:2400, lvl:1, rank:3 },
  { id:"escudo",    side:"placa", slot:"armadura", name:"Escudo antidisturbios",     val:24, price:4200, lvl:1, rank:4 },
  { id:"manopla",   side:"plata", slot:"arma",     name:"Manopla de bronce",         val:10, price:380,  lvl:1, rank:1 },
  { id:"placas",    side:"plata", slot:"armadura", name:"Campera con placas",        val:15, price:1350, lvl:1, rank:2 },
  { id:"recortada", side:"plata", slot:"arma",     name:"Escopeta recortada",        val:21, price:2200, lvl:1, rank:3 },
  { id:"negro",     side:"plata", slot:"armadura", name:"Chaleco del mercado negro", val:23, price:3900, lvl:1, rank:4 }
);
/* Gente del otro bando para los duelos de La calle (los "otros jugadores" de BiteFight) */
export const FOES: Record<Side, string[]> = {
  placa:["Agente Sosa","Cabo Ferreyra","Sargento Paredes","Oficial Benítez","Agente Quiroga","Cabo Ledesma","Oficial Romero","Agente Molina","Subinspectora Luna","Oficial Toledo"],
  plata:["El Rengo Acosta","Chino Funes","El Pelado Godoy","Manco Suárez","La Gata Ibarra","Tito Bermúdez","El Ruso Olmedo","Nene Cabral","Pochi Villalba","La Turca"]
};
/* [nombre, bando, respeto, nivel] */
export const RIVALS: [string, Side, number, number][] = [
  ["Comisario Arce","placa",2600,24], ["La Turca","plata",1900,21], ["Inspector Vidal","placa",1300,18], ["El Gallego","plata",980,16],
  ["Subinspectora Luna","placa",720,14], ["Manco Suárez","plata",510,12], ["Sargento Paredes","placa",340,10], ["La Gata Ibarra","plata",220,8],
  ["Cabo Ferreyra","placa",130,6], ["Chino Funes","plata",75,5], ["Agente Sosa","placa",30,3], ["Nene Cabral","plata",10,2]
];

/* Misiones de cada bando: se hacen en orden y piden rango */
export const MISSIONS: Record<Side, Mission[]> = {
  placa:[
    { id:"ronda", rank:0, title:"Ronda nocturna", reward:{ gold:120, xp:60, resp:30 },
      intro:"La comisaria te manda a la zona del mercado. «Hubo tres robos esta semana. Quiero saber quién es.»",
      steps:[
        { text:"Hablar con los puesteros del mercado. Nadie quiere hablar con la policía.", stat:"lab", diff:7, energy:2, dmg:0,
          ok:"La del puesto de verduras te cuenta de un pibe con campera roja que pasa todas las noches.", ko:"Te bajan las persianas en la cara." },
        { text:"El de campera roja te ve y sale corriendo entre los puestos.", stat:"ref", diff:7, energy:2, dmg:.1,
          ok:"Lo agarrás antes de que llegue a la avenida.", ko:"Te tropezás con un cajón de tomates y lo perdés de vista." },
        { text:"No estaba solo. Su hermano mayor te espera en el estacionamiento.", fight:{ name:"Los hermanos Vera", mult:.9 }, energy:3,
          win:"Los dos terminan esposados contra el patrullero.", lose:"Te dejan en el piso y se escapan. Vas a tener que buscarlos de nuevo." },
        { text:"Labrar el acta en la comisaría.", energy:1, auto:true, ok:"Escribís el acta con dos dedos. La comisaria la firma sin leerla." }
      ],
      outro:"«Buen trabajo. Pero esos pibes trabajaban para alguien. Y yo sé para quién.»" },
    { id:"allanamiento", rank:2, title:"Allanamiento en el puerto", reward:{ gold:400, xp:180, resp:90 },
      intro:"«Tenemos una orden para el depósito 7. Es de La Señora. Si encontramos algo, la tenemos.»",
      steps:[
        { text:"Conseguir que el juez firme la orden antes del amanecer.", stat:"lab", diff:10, energy:3, dmg:0,
          ok:"El juez firma en pijama, todavía medio dormido.", ko:"El secretario del juzgado no te deja pasar. Volvé con mejores argumentos." },
        { text:"Entrar al depósito antes de que alguien avise por radio.", stat:"ref", diff:10, energy:3, dmg:.12,
          ok:"Cortás el candado y entran antes de que suene el primer celular.", ko:"Alguien gritó «¡la policía!» y terminaste corriendo detrás de un montacargas." },
        { text:"El encargado del depósito y su perro no están de acuerdo con la orden.", fight:{ name:"El encargado del depósito", mult:1.0 }, energy:4,
          win:"El encargado termina sentado sobre una caja, esposado. El perro te lame la mano.", lose:"Te encierran en un contenedor media hora. Hay que volver a intentarlo." },
        { text:"Revisar contenedor por contenedor, con olor a pescado y el frío del puerto.", stat:"dur", diff:10, energy:3, dmg:.15,
          ok:"En el último contenedor aparece una libreta con nombres y números.", ko:"Se te vino encima una pila de cajones." },
        { text:"Llevar la libreta a la comisaría.", energy:1, auto:true, ok:"La comisaria hojea la libreta y sonríe por primera vez." }
      ],
      outro:"«Acá están todos. Los que cobran, los que pagan. Y una dirección: la casa de La Señora.»" },
    { id:"senora", rank:4, title:"Detener a La Señora", reward:{ gold:1500, xp:600, resp:300 },
      intro:"«Es esta noche. Si se nos escapa, no vuelve a aparecer en diez años.»",
      steps:[
        { text:"Convencer a un soplón de que te diga por dónde va a salir.", stat:"lab", diff:14, energy:3, dmg:0,
          ok:"«Por el muelle viejo, a las tres. Y yo nunca te dije nada.»", ko:"El soplón se ríe y te pide más plata de la que tenés." },
        { text:"Seguir el auto de La Señora sin que te vean, con las luces apagadas.", stat:"ref", diff:14, energy:4, dmg:.15,
          ok:"Llegás al muelle viejo dos minutos antes que ella.", ko:"Te vieron. Frenaste de golpe y te comiste el volante." },
        { text:"Su mano derecha, el Gallego, se pone entre vos y la lancha.", fight:{ name:"El Gallego", mult:1.1 }, energy:5,
          win:"El Gallego queda tirado en el muelle. La lancha no arranca.", lose:"El Gallego te tira al agua helada. Hay que volver a intentarlo." },
        { text:"La Señora no se entrega. Hay que sacarla de la lancha a la fuerza.", stat:"fue", diff:14, energy:3, dmg:.1,
          ok:"Sale esposada, con el tapado mojado y la mirada clavada en vos.", ko:"Se te resbaló de las manos y casi te arrastra con ella." },
        { text:"Llevarla a la comisaría con la sirena prendida.", energy:1, auto:true, ok:"Media Bahía Gris se asoma a la ventana para ver pasar el patrullero." }
      ],
      outro:"La comisaria te da la mano delante de todos. «Bahía Gris está un poco más limpia. Por ahora.»" }
  ],
  plata:[
    { id:"kiosco", rank:0, title:"La protección", reward:{ gold:180, xp:60, resp:30, heat:15 },
      intro:"La Señora te da una lista de comercios. «Todos pagan. El kiosco de Belgrano y Mitre dejó de pagar. Recordáselo.»",
      steps:[
        { text:"Entrar al kiosco sin que te vea el patrullero que siempre está estacionado enfrente.", stat:"ref", diff:7, energy:2, dmg:.1,
          ok:"Esperás el cambio de turno y entrás por atrás.", ko:"El agente te miró raro. Diste la vuelta manzana y te chocaste un poste." },
        { text:"Explicarle al kiosquero, con buenos modos, por qué le conviene pagar.", stat:"lab", diff:7, energy:2, dmg:0,
          ok:"Te dice que paga, pero que antes hables con su sobrino.", ko:"Te dice que no tiene miedo y te saca con la escoba." },
        { text:"El sobrino del kiosquero hace boxeo y te espera en la vereda.", fight:{ name:"El sobrino del kiosquero", mult:.9 }, energy:3,
          win:"El sobrino queda sentado en el cordón. El kiosquero ya tiene el sobre listo.", lose:"El sobrino te saca a las piñas. Volvé cuando estés mejor." },
        { text:"Llevarle el sobre a La Señora.", energy:1, auto:true, ok:"La Señora cuenta los billetes sin mirarlos." }
      ],
      outro:"«Bien. Sin escándalo. Así me gusta. Ahora te voy a dar algo más grande.»" },
    { id:"blindado", rank:2, title:"El blindado", reward:{ gold:600, xp:180, resp:90, heat:25 },
      intro:"«Todos los viernes sale un camión de caudales del banco del centro. Este viernes no llega.»",
      steps:[
        { text:"Conseguir el recorrido exacto con un custodio que debe plata.", stat:"lab", diff:10, energy:3, dmg:0,
          ok:"Te lo anota en una servilleta, con la mano temblando.", ko:"El custodio se asusta y no quiere hablar. Dale tiempo." },
        { text:"Cruzar un camión en la calle justo cuando dobla el blindado.", stat:"ref", diff:10, energy:3, dmg:.12,
          ok:"El blindado frena a centímetros del camión.", ko:"Llegaste tarde y casi te lleva puesto." },
        { text:"Los dos custodios bajan con bastones.", fight:{ name:"Los custodios del blindado", mult:1.0 }, energy:4,
          win:"Los custodios terminan sentados en la vereda, atados con sus propios precintos.", lose:"Te reducen y tenés que escapar con las manos vacías." },
        { text:"Abrir la puerta trasera del blindado con una barreta.", stat:"fue", diff:10, energy:3, dmg:.1,
          ok:"La puerta cede con un chirrido. Adentro hay bolsas y más bolsas.", ko:"La barreta se te resbala y te pegás en la cara." },
        { text:"Abandonar el camión y llevar las bolsas al depósito.", energy:1, auto:true, ok:"La Señora te sirve un whisky. Es la primera vez." }
      ],
      outro:"«Ahora la policía te conoce la cara. Eso tiene un precio. Y una ventaja.»" },
    { id:"comisaria", rank:4, title:"La libreta de la 4ª", reward:{ gold:2200, xp:600, resp:300, heat:40 },
      intro:"«La comisaria Ríos tiene una libreta con todos mis nombres, guardada en la comisaría. Quiero esa libreta. Y quiero que sepa que fui yo.»",
      steps:[
        { text:"Hacerte pasar por abogado para entrar a la comisaría.", stat:"lab", diff:14, energy:3, dmg:0,
          ok:"El de la mesa de entradas te hace pasar sin mirar la credencial.", ko:"Te pide la matrícula y no tenés. Salís como si nada." },
        { text:"Llegar al depósito de pruebas sin cruzarte a nadie.", stat:"ref", diff:14, energy:4, dmg:.12,
          ok:"Pasás por detrás de un oficial que lee el diario.", ko:"Casi te ven. Te escondiste media hora en el baño y te golpeaste contra la puerta." },
        { text:"Afuera prendieron fuego un auto para distraer. Hay que aguantar el humo y encontrar la caja.", stat:"dur", diff:14, energy:3, dmg:.15,
          ok:"Con un pañuelo en la cara, encontrás la libreta.", ko:"El humo te tumba. Saliste tosiendo." },
        { text:"La comisaria Ríos en persona te encuentra con la libreta en la mano.", fight:{ name:"Comisaria Inés Ríos", mult:1.1 }, energy:5,
          win:"La dejás encerrada en su propia oficina, con la placa sobre el escritorio.", lose:"Te tumba de una piña y escapás por la ventana sin la libreta." },
        { text:"Entregarle la libreta a La Señora.", energy:1, auto:true, ok:"La Señora quema la libreta en la estufa, hoja por hoja." }
      ],
      outro:"«Desde hoy, en Bahía Gris no se mueve nada sin que vos lo sepas.»" }
  ]
};


/* Tutorial: cada encargo de Marga destraba una pestaña nueva */
export interface TutStep {
  id: string; tab: TabKey; title: string; say: string;
  goal: (s: PlayerState) => boolean; prog: (s: PlayerState) => string; reward: { gold: number; xp: number };
}
export const TUT: TutStep[] = [
  { id:"t1", tab:"laburos",  title:"Recién llegado",
    say:"Si te vas a quedar en Bahía Gris, necesitás plata. Agarrá un par de laburos. Cada uno gasta energía, que se recarga sola.",
    goal:s=>s.c.jobs>=2, prog:s=>`Laburos hechos: ${Math.min(s.c.jobs,2)} de 2`, reward:{gold:15,xp:6} },
  { id:"t2", tab:"gimnasio", title:"Ponerse en forma",
    say:"Así como estás no durás una semana. En el gimnasio de Don Tito pagás y entrenás. Subí cualquier atributo.",
    goal:s=>s.c.train>=1, prog:s=>`Atributos entrenados: ${Math.min(s.c.train,1)} de 1`, reward:{gold:20,xp:6} },
  { id:"t3", tab:"feria",    title:"Algo para defenderte",
    say:"La calle no perdona. En la feria de usados conseguís algo para pegar o algo para que no te peguen. Comprá una cosa.",
    goal:s=>s.c.buy>=1, prog:s=>`Compras: ${Math.min(s.c.buy,1)} de 1`, reward:{gold:20,xp:8} },
  { id:"t4", tab:"ring",     title:"Primer round",
    say:"Abajo del gimnasio hay un ring. Ahí aprendés a pelear sin que nadie termine preso. Ganale al sparring.",
    goal:s=>s.c.spar>=1, prog:s=>`Peleas ganadas: ${Math.min(s.c.spar,1)} de 1`, reward:{gold:25,xp:10} },
  { id:"t5", tab:"guardia",  title:"Puntos y gasas",
    say:"Te dejaron la cara como un mapa. En la guardia del hospital te curan por unos pesos. Si estás entero, pasá igual a conocerla.",
    goal:s=>s.c.heal>=1 || !!s.seenTab.guardia, prog:()=>`Visitar la guardia`, reward:{gold:10,xp:6} },
  { id:"t6", tab:"misiones", title:"Un encargo de confianza",
    say:"Ahora sí. Tengo un trabajo de verdad para vos. Fijate en la pestaña Misiones. Son varias partes y cada una pide algo distinto.",
    goal:s=>s.c.valija>=1, prog:s=>`Misión «La valija»: ${s.mis ? `etapa ${s.mis.step+1} de ${VALIJA.steps.length}` : "sin empezar"}`, reward:{gold:40,xp:15} }
];
export const TAB_NAMES: Record<TabKey, string> = { laburos:"Laburos", gimnasio:"Gimnasio", feria:"Feria de usados", ring:"Ring", guardia:"Guardia", misiones:"Misiones", calle:"La calle", ranking:"Ranking" };
