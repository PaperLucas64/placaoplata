/* Las cuatro pandillas de Maires, la policía (amenaza para todos) y la casa.
   Pertenecés a una pandilla cuando tiene la mitad o más de tu afinidad (todo lo que hiciste pesa igual). */
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
               perk: "Tu nivel de búsqueda sube 30% menos", say: "Conozco cada calle de Maires. Y cada salida." }
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
  { id:"financ",   name:"Asalto a una financiera",         cost:6, risk:3, gold:[200,360], xp:[55,74], resp:5, heat:8, lvl:15, fail:"El de seguridad no estaba dormido." }
];

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
const R1 = { gold: 150, xp: 60, resp: 30, heat: 10 }, R2 = { gold: 500, xp: 180, resp: 90, heat: 20 }, R3 = { gold: 1800, xp: 600, resp: 300, heat: 35 };

export const MISSIONS: Record<Gang, Mission[]> = {
  familia: [
    { id:"kiosco", gang:"familia", tier:0, rank:0, title:"La protección", reward:R1,
      intro:"La Señora te da una lista de comercios. «Todos pagan. El kiosco de Belgrano y Mitre dejó de pagar. Recordáselo.»",
      steps:[
        { text:"Entrar al kiosco sin que te vea el patrullero que siempre está estacionado enfrente.", stat:"ref", diff:5, energy:2, dmg:.1,
          ok:"Esperás el cambio de turno y entrás por atrás.", ko:"El agente te miró raro. Diste la vuelta manzana y te chocaste un poste." },
        { text:"Explicarle al kiosquero, con buenos modos, por qué le conviene pagar.", stat:"lab", diff:5, energy:2, dmg:0,
          ok:"Te dice que paga, pero que antes hables con su sobrino.", ko:"Te dice que no tiene miedo y te saca con la escoba." },
        { text:"El sobrino del kiosquero hace boxeo y te espera en la vereda.", fight:{ name:"El sobrino del kiosquero", mult:.85 }, energy:3,
          win:"El sobrino queda sentado en el cordón. El kiosquero ya tiene el sobre listo.", lose:"El sobrino te saca a las piñas. Volvé cuando estés mejor." },
        { text:"Llevarle el sobre a La Señora.", energy:1, auto:true, ok:"La Señora cuenta los billetes sin mirarlos." }
      ],
      outro:"«Bien. Sin escándalo. Así me gusta. Ahora te voy a dar algo más grande.»" },
    { id:"blindado", gang:"familia", tier:1, rank:2, title:"El blindado", reward:R2,
      intro:"«Todos los viernes sale un camión de caudales del banco del centro. Este viernes no llega.»",
      steps:[
        { text:"Conseguir el recorrido exacto con un custodio que debe plata.", stat:"lab", diff:8, energy:3, dmg:0,
          ok:"Te lo anota en una servilleta, con la mano temblando.", ko:"El custodio se asusta y no quiere hablar. Dale tiempo." },
        { text:"Cruzar un camión en la calle justo cuando dobla el blindado.", stat:"ref", diff:8, energy:3, dmg:.12,
          ok:"El blindado frena a centímetros del camión.", ko:"Llegaste tarde y casi te lleva puesto." },
        { text:"Los dos custodios bajan con bastones.", fight:{ name:"Los custodios del blindado", mult:.9 }, energy:4,
          win:"Los custodios terminan sentados en la vereda, atados con sus propios precintos.", lose:"Te reducen y tenés que escapar con las manos vacías." },
        { text:"Abrir la puerta trasera del blindado con una barreta.", stat:"fue", diff:8, energy:3, dmg:.1,
          ok:"La puerta cede con un chirrido. Adentro hay bolsas y más bolsas.", ko:"La barreta se te resbala y te pegás en la cara." },
        { text:"Abandonar el camión y llevar las bolsas al depósito.", energy:1, auto:true, ok:"La Señora te sirve un whisky. Es la primera vez." }
      ],
      outro:"«Ahora la policía te conoce la cara. Eso tiene un precio. Y una ventaja.»" },
    { id:"comisaria", gang:"familia", tier:2, rank:4, title:"La libreta de la 4ª", reward:R3,
      intro:"«La comisaria Ríos tiene una libreta con todos mis nombres, guardada en la comisaría. Quiero esa libreta. Y quiero que sepa que fui yo.»",
      steps:[
        { text:"Hacerte pasar por abogado para entrar a la comisaría.", stat:"lab", diff:17, energy:3, dmg:0,
          ok:"El de la mesa de entradas te hace pasar sin mirar la credencial.", ko:"Te pide la matrícula y no tenés. Salís como si nada." },
        { text:"Llegar al depósito de pruebas sin cruzarte a nadie.", stat:"ref", diff:17, energy:4, dmg:.12,
          ok:"Pasás por detrás de un oficial que lee el diario.", ko:"Casi te ven. Te escondiste media hora en el baño y te golpeaste contra la puerta." },
        { text:"Afuera prendieron fuego un auto para distraer. Hay que aguantar el humo y encontrar la caja.", stat:"dur", diff:17, energy:3, dmg:.15,
          ok:"Con un pañuelo en la cara, encontrás la libreta.", ko:"El humo te tumba. Saliste tosiendo." },
        { text:"La comisaria Ríos en persona te encuentra con la libreta en la mano.", fight:{ name:"Comisaria Inés Ríos", mult:.9 }, energy:5,
          win:"La dejás encerrada en su propia oficina, con la placa sobre el escritorio.", lose:"Te tumba de una piña y escapás por la ventana sin la libreta." },
        { text:"Entregarle la libreta a La Señora.", energy:1, auto:true, ok:"La Señora quema la libreta en la estufa, hoja por hoja." }
      ],
      outro:"«Desde hoy, en Maires no se mueve nada sin que vos lo sepas.»" }
  ],
  sindicato: [
    { id:"paro", gang:"sindicato", tier:0, rank:0, title:"El paro", reward:R1,
      intro:"Don Ramón Ferrante te recibe en el galpón 3. «Mañana no entra ni sale un camión del puerto. Vos te encargás de que se entienda.»",
      steps:[
        { text:"Convencer a los estibadores del turno noche de que paren.", stat:"lab", diff:5, energy:2, dmg:0,
          ok:"Te escuchan, se miran y apagan las grúas.", ko:"Te dicen que tienen familia y que Don Ramón no les paga el alquiler." },
        { text:"Cruzar un acoplado en la entrada del puerto antes del amanecer.", stat:"ref", diff:5, energy:2, dmg:.1,
          ok:"El acoplado queda de costado, justo en la barrera.", ko:"Le erraste al portón y te comiste el guardabarros." },
        { text:"Un capataz rompehuelgas viene con dos matones a sacar el acoplado.", fight:{ name:"El capataz rompehuelgas", mult:.85 }, energy:3,
          win:"El capataz vuelve a su oficina sin los matones.", lose:"Te sacan a la rastra y el acoplado se mueve. Hay que volver a intentarlo." },
        { text:"Llevarle el petitorio firmado a Don Ramón.", energy:1, auto:true, ok:"Don Ramón lo lee, lo rompe y se ríe. «Ya firmaron. Eso es lo que importa.»" }
      ],
      outro:"«Paraste un puerto entero. Ahora sí podemos hablar de negocios.»" },
    { id:"deposito7", gang:"sindicato", tier:1, rank:2, title:"La carga del depósito 7", reward:R2,
      intro:"«En el depósito 7 La Señora guarda lo que entra sin papeles. Esta noche esa carga es nuestra.»",
      steps:[
        { text:"Arreglar con el sereno del depósito para que mire para otro lado.", stat:"lab", diff:8, energy:3, dmg:0,
          ok:"El sereno se va a tomar un café que dura dos horas.", ko:"El sereno se hace el honesto. Va a haber que volver con más plata." },
        { text:"Entrar antes de que alguien avise por radio.", stat:"ref", diff:8, energy:3, dmg:.12,
          ok:"Cortás el candado y entrás antes de que suene el primer celular.", ko:"Alguien gritó y terminaste corriendo detrás de un montacargas." },
        { text:"El encargado del depósito y su perro no están de acuerdo.", fight:{ name:"El encargado del depósito", mult:.9 }, energy:4,
          win:"El encargado termina sentado sobre una caja. El perro te lame la mano.", lose:"Te encierran en un contenedor media hora. Hay que volver a intentarlo." },
        { text:"Cargar los cajones en el camión, con el olor a pescado y el frío del puerto.", stat:"dur", diff:8, energy:3, dmg:.15,
          ok:"El último cajón entra justo. El camión arranca.", ko:"Se te vino encima una pila de cajones." },
        { text:"Llevar el camión a los galpones.", energy:1, auto:true, ok:"Don Ramón abre un cajón y silba bajito." }
      ],
      outro:"«La Señora ya sabe que fuimos nosotros. Mejor. Que sepa con quién se mete.»" },
    { id:"puerto", gang:"sindicato", tier:2, rank:4, title:"Fuera del puerto", reward:R3,
      intro:"«La Señora se escapa esta noche por el muelle viejo con todo lo que tiene. Si se va, el puerto es nuestro. Si la paramos, también.»",
      steps:[
        { text:"Convencer a un soplón de que te diga por dónde va a salir.", stat:"lab", diff:17, energy:3, dmg:0,
          ok:"«Por el muelle viejo, a las tres. Y yo nunca te dije nada.»", ko:"El soplón se ríe y te pide más plata de la que tenés." },
        { text:"Seguir el auto de La Señora sin que te vean, con las luces apagadas.", stat:"ref", diff:17, energy:4, dmg:.15,
          ok:"Llegás al muelle viejo dos minutos antes que ella.", ko:"Te vieron. Frenaste de golpe y te comiste el volante." },
        { text:"Su mano derecha, el Gallego, se pone entre vos y la lancha.", fight:{ name:"El Gallego", mult:.9 }, energy:5,
          win:"El Gallego queda tirado en el muelle. La lancha no arranca.", lose:"El Gallego te tira al agua helada. Hay que volver a intentarlo." },
        { text:"Bajar la carga de la lancha antes de que llegue la policía.", stat:"fue", diff:17, energy:3, dmg:.1,
          ok:"La lancha queda vacía y La Señora se va sin nada.", ko:"Se te resbaló un cajón y casi te arrastra al agua." },
        { text:"Volver a los galpones con la carga.", energy:1, auto:true, ok:"Medio Maires se entera antes del amanecer." }
      ],
      outro:"Don Ramón te da la mano delante de todos. «El puerto es del Sindicato. Y vos sos parte.»" }
  ],
  barra: [
    { id:"trapos", gang:"barra", tier:0, rank:0, title:"Los trapos", reward:R1,
      intro:"El Tano Lucero te espera en la puerta 6 de la cancha. «Los del Oeste se llevaron nuestra bandera. El domingo tiene que estar colgada otra vez.»",
      steps:[
        { text:"Averiguar en qué bar del Oeste guardan la bandera.", stat:"lab", diff:5, energy:2, dmg:0,
          ok:"Un mozo te cuenta todo por una propina.", ko:"Preguntaste demasiado y te miraron feo. Mejor volver otro día." },
        { text:"Entrar al bar por la ventana del baño.", stat:"ref", diff:5, energy:2, dmg:.1,
          ok:"Entrás sin que nadie levante la vista del partido.", ko:"La ventana era más chica de lo que parecía." },
        { text:"El dueño del bar es de la barra del Oeste y te encuentra con la bandera.", fight:{ name:"El dueño del bar", mult:.85 }, energy:3,
          win:"Salís con la bandera enrollada bajo el brazo.", lose:"Te saca a los sopapos. La bandera sigue ahí." },
        { text:"Llevarle la bandera al Tano.", energy:1, auto:true, ok:"El Tano la besa y la cuelga él mismo." }
      ],
      outro:"«Sos de los nuestros, pibe. El domingo venís a la popular.»" },
    { id:"reventa", gang:"barra", tier:1, rank:2, title:"La reventa", reward:R2,
      intro:"«Para el clásico hay tres mil entradas. Mil son nuestras. Vos te encargás de que se vendan.»",
      steps:[
        { text:"Conseguir las entradas con un dirigente del club.", stat:"lab", diff:8, energy:3, dmg:0,
          ok:"El dirigente te da un sobre y te pide que no lo nombres.", ko:"El dirigente se hace el distraído. Va a haber que insistir." },
        { text:"Vender en la puerta sin que te agarre la policía.", stat:"ref", diff:8, energy:3, dmg:.12,
          ok:"Vendiste todo antes de que llegaran los patrulleros.", ko:"Un policía de civil te persiguió tres cuadras." },
        { text:"Los de la barra rival quieren su parte de la reventa.", fight:{ name:"Los del Oeste", mult:.9 }, energy:4,
          win:"Los del Oeste se van con las manos vacías.", lose:"Te sacan la mitad de la plata. Hay que recuperarla." },
        { text:"Aguantar la avalancha en la puerta cuando abren.", stat:"dur", diff:8, energy:3, dmg:.15,
          ok:"Quedaste de pie y con la plata.", ko:"La avalancha te pasó por arriba." },
        { text:"Llevarle la recaudación al Tano.", energy:1, auto:true, ok:"El Tano cuenta y te devuelve un fajo. «Tu parte.»" }
      ],
      outro:"«La cancha es nuestra los domingos. Y ahora vos también.»" },
    { id:"clasico", gang:"barra", tier:2, rank:4, title:"El clásico", reward:R3,
      intro:"«El domingo es el clásico. Si ganamos la tribuna, el barrio es nuestro por diez años.»",
      steps:[
        { text:"Arreglar con la policía para que la barra entre sin cacheo.", stat:"lab", diff:17, energy:3, dmg:0,
          ok:"El comisario mira para otro lado a cambio de un palco.", ko:"El comisario no quiere saber nada. Va a haber que buscar otra puerta." },
        { text:"Bancar la tribuna mientras los del Oeste tiran de todo.", stat:"dur", diff:17, energy:4, dmg:.15,
          ok:"La popular sigue siendo nuestra.", ko:"Te dieron con un cascote. Ves doble." },
        { text:"El jefe de la barra del Oeste te busca en el entretiempo.", fight:{ name:"El Pampa", mult:.9 }, energy:5,
          win:"El Pampa se va en camilla. Su barra se queda sin jefe.", lose:"El Pampa te deja tirado en el pasillo. Hay que volver a intentarlo." },
        { text:"Bajar el trapo del Oeste de la tribuna visitante.", stat:"fue", diff:17, energy:3, dmg:.1,
          ok:"El trapo del Oeste cae a la cancha. La popular explota.", ko:"El trapo estaba atado con alambre. Te cortaste las manos." },
        { text:"Llevarle el trapo al Tano.", energy:1, auto:true, ok:"El Tano lo quema en el medio de la calle, delante de todos." }
      ],
      outro:"«Diez años, pibe. El barrio es nuestro diez años.»" }
  ],
  amarillos: [
    { id:"taximetro", gang:"amarillos", tier:0, rank:0, title:"Viaje sin taxímetro", reward:R1,
      intro:"Rita Quiroga te tira las llaves de un remís. «Un paquete, una dirección, nada de preguntas. Y el taxímetro apagado.»",
      steps:[
        { text:"Cruzar la avenida en hora pico con el paquete en el asiento de atrás.", stat:"ref", diff:5, energy:2, dmg:.1,
          ok:"Te mandaste por una calle que nadie usa.", ko:"Te encerraron en un embotellamiento y te comiste un cordón." },
        { text:"Convencer al portero del edificio de que sos el remisero de siempre.", stat:"lab", diff:5, energy:2, dmg:0,
          ok:"El portero te deja pasar y hasta te abre el ascensor.", ko:"El portero llama al encargado. Mejor volver más tarde." },
        { text:"El que recibe el paquete no quiere pagar el viaje.", fight:{ name:"El pasajero pesado", mult:.85 }, energy:3,
          win:"Pagó el viaje, la propina y la puerta que rompió.", lose:"Te echó a empujones. Hay que volver a cobrar." },
        { text:"Devolverle el remís a Rita.", energy:1, auto:true, ok:"Rita revisa el auto, ve que no tiene rayones y sonríe." }
      ],
      outro:"«Manejás bien y no preguntás. Eso vale oro en esta ciudad.»" },
    { id:"desarmadero", gang:"amarillos", tier:1, rank:2, title:"El desarmadero", reward:R2,
      intro:"«Hay un auto importado en un garaje de la costanera. Mañana tiene que estar en cuatrocientas partes.»",
      steps:[
        { text:"Llevarte el auto sin que salte la alarma.", stat:"ref", diff:8, energy:3, dmg:.12,
          ok:"El auto arranca sin un ruido.", ko:"La alarma sonó y tuviste que salir corriendo." },
        { text:"Conseguir papeles truchos en la gestoría de un amigo.", stat:"lab", diff:8, energy:3, dmg:0,
          ok:"Los papeles quedan mejor que los originales.", ko:"El gestor se asustó y te cerró la puerta." },
        { text:"El dueño del auto rastreó el GPS y viene con dos amigos.", fight:{ name:"El dueño del importado", mult:.9 }, energy:4,
          win:"El dueño decide que el auto no valía tanto.", lose:"Te sacan del garaje a patadas." },
        { text:"Desarmar el auto antes de que amanezca.", stat:"fue", diff:8, energy:3, dmg:.1,
          ok:"Cuatrocientas partes, prolijas y numeradas.", ko:"Se te cayó el motor arriba del pie." },
        { text:"Avisarle a Rita que está listo.", energy:1, auto:true, ok:"Rita ya tiene comprador para cada pieza." }
      ],
      outro:"«En una noche hiciste lo que a otros les lleva una semana.»" },
    { id:"picada", gang:"amarillos", tier:2, rank:4, title:"La picada de la costanera", reward:R3,
      intro:"«El Sindicato quiere quedarse con las remiserías. Don Ramón Ferrante apostó todo a una picada por la costanera. Le vamos a ganar.»",
      steps:[
        { text:"Ganar la picada contra el piloto del Sindicato.", stat:"ref", diff:17, energy:4, dmg:.15,
          ok:"Cruzás la meta con medio auto de ventaja.", ko:"Te fuiste de costado en la última curva." },
        { text:"Cobrar la apuesta antes de que Don Ramón se arrepienta.", stat:"lab", diff:17, energy:3, dmg:0,
          ok:"Don Ramón paga, con cara de que no se va a olvidar.", ko:"Don Ramón dice que hiciste trampa. Va a haber que convencerlo." },
        { text:"Don Ramón Ferrante no se va a ir sin pelear.", fight:{ name:"Don Ramón Ferrante", mult:.9 }, energy:5,
          win:"Don Ramón se va en el auto de un amigo. Las remiserías siguen siendo amarillas.", lose:"Don Ramón te encierra contra la baranda. Hay que volver a intentarlo." },
        { text:"Aguantar el choque cuando los del Sindicato te encierran a la salida.", stat:"dur", diff:17, energy:3, dmg:.15,
          ok:"Salís del auto caminando.", ko:"Te sacaron del auto en camilla." },
        { text:"Volver a la remisería con la plata.", energy:1, auto:true, ok:"Todas las remiserías prenden las balizas a la vez." }
      ],
      outro:"«Las calles de Maires son amarillas. Y vos manejás.»" }
  ]
};

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
