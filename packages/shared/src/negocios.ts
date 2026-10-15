/* Negocios: propiedades que comprás y que dejan plata por hora (hay que pasar a cobrarla: junta hasta 24 horas).
   Cada negocio trae sus propias misiones al tablón de la calle. */
import type { StatKey } from "./types.js";

export type PropId = "kiosco24" | "taxi" | "terraza" | "lavadero" | "taller" | "boliche";
export interface Prop { id: PropId; name: string; lvl: number; price: number; perHour: number; place: string; help: string; heat?: number; who: string }
export const PROPS: Prop[] = [
  { id: "kiosco24", name: "Maxikiosco 24 horas", lvl: 4,  price: 2500,  perHour: 25,  place: "Once y Medio", who: "el kiosco",
    help: "Golosinas, cigarrillos y lo que no está en la vidriera." },
  { id: "taxi",     name: "Licencia de taxi",    lvl: 8,  price: 6000,  perHour: 50,  place: "San Telmón", who: "el taxi",
    help: "Un chofer trabaja el auto por vos. A veces aparece un pasajero raro." },
  { id: "terraza",  name: "Plantación en una terraza", lvl: 12, price: 12000, perHour: 110, place: "Palermo Soja", heat: 2, who: "la terraza",
    help: "Cien macetas bajo media sombra. Cada cobro sube tu nivel de búsqueda." },
  { id: "lavadero", name: "Lavadero de autos",   lvl: 16, price: 22000, perHour: 180, place: "Barrancas", who: "el lavadero",
    help: "Se lavan autos. Y plata." },
  { id: "taller",   name: "Taller mecánico",     lvl: 20, price: 35000, perHour: 260, place: "Mataderos", who: "el taller",
    help: "Los arreglos de tu moto o tu auto salen 30% menos." },
  { id: "boliche",  name: "Boliche en Palermo Soja", lvl: 25, price: 60000, perHour: 420, place: "Palermo Soja", who: "el boliche",
    help: "La noche de Maires pasa por tu puerta." }
];
export const PROP_CAP_HOURS = 24;
export const propOf = (id: string) => PROPS.find(p => p.id === id);

/* lo que juntó un negocio desde la última vez que cobraste */
export const propIncome = (p: Prop, since: number, now: number) =>
  Math.floor(p.perHour * Math.min(PROP_CAP_HOURS, Math.max(0, now - since) / 3_600_000));

/* misiones de cada negocio (las arma el generador del tablón). Algunas son viajes al interior (`place`). */
export interface PropObjective { text: string; stat: StatKey; place?: string }
export const PROP_OBJECTIVES: Record<PropId, PropObjective[]> = {
  kiosco24: [
    { text: "Recibir mercadería que llegó sin factura", stat: "lab" }, { text: "Sacar a los pibes que afanan alfajores", stat: "fue" },
    { text: "Esconder la recaudación antes de que pase el inspector", stat: "ref" }, { text: "Bancarte la noche detrás del mostrador", stat: "dur" }
  ],
  taxi: [
    { text: "Llevar a un pasajero que no quiere decir su nombre", stat: "lab" }, { text: "Perder a un auto que te sigue desde Retiro", stat: "ref" },
    { text: "Llevar un bolso cerrado a Mar del Plato", stat: "ref", place: "Mar del Plato" }, { text: "Recuperar el taxi que te robaron en la parada", stat: "fue" }
  ],
  terraza: [
    { text: "Cosechar antes de que llegue la tormenta", stat: "dur" }, { text: "Esconder las macetas antes del allanamiento", stat: "ref" },
    { text: "Vender la cosecha en Rosarito", stat: "lab", place: "Rosarito" }, { text: "Echar al vecino que sube a sacar fotos", stat: "fue" }
  ],
  lavadero: [
    { text: "Lavar la plata de un cliente nervioso", stat: "lab" }, { text: "Hacer desaparecer un auto con manchas raras", stat: "ref" },
    { text: "Llevar efectivo a una financiera de La Plata Dulce", stat: "dur", place: "La Plata Dulce" }, { text: "Convencer al contador de que no pregunte", stat: "lab" }
  ],
  taller: [
    { text: "Cambiarle el motor a un auto robado", stat: "fue" }, { text: "Buscar repuestos en un desarmadero", stat: "lab", place: "Liniers Sur" },
    { text: "Probar un auto preparado en la ruta a Cordobita", stat: "ref", place: "Cordobita" }, { text: "Aguantar la inspección municipal", stat: "dur" }
  ],
  boliche: [
    { text: "Sacar a un patovica que trabaja para otros", stat: "fue" }, { text: "Arreglar con el inspector de habilitaciones", stat: "lab" },
    { text: "Traer a un DJ famoso desde Mar del Plato", stat: "lab", place: "Mar del Plato" }, { text: "Esconder a un famoso que se metió en problemas", stat: "ref" }
  ]
};
