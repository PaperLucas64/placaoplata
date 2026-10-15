/* Ritmo del juego. Todo se ajusta desde acá (ver docs/BALANCE.md).
   La unidad de juego es la energía: 1 punto cada ENERGY_EVERY. Los demás tiempos van en proporción. */
const MIN = 60_000;

export const ENERGY_MAX = 40;          // una sesión: la barra llena alcanza para el tutorial entero
export const ENERGY_EVERY = 1.5 * MIN; // +1 energía; la barra se llena en 1 hora
export const HEAL_EVERY = 0.6 * MIN;   // +2% de vida; de cero a lleno en ~30 min
export const SALARY_EVERY = 60 * MIN;  // sueldo de la placa
export const ATTACK_EVERY = 6 * MIN;   // ventana de emboscadas de personajes del juego
export const AMBUSH_CHANCE = 0.3;
export const AMBUSH_MAX_CATCHUP = 1;   // si estuviste afuera, como mucho te emboscan una vez
export const HEAT_EVERY = 1.5 * MIN;   // -1 de calor (al mismo ritmo que la energía)

/* La calle */
export const DUEL_COST = 3;
export const SCOUT_COST = 1;
export const TARGETS = 5;
export const MIN_HP_TO_FIGHT = 0.25;   // ni atacás ni te atacan con menos de esto
export const PVP_SAME_TARGET_EVERY = 60 * MIN; // a un mismo jugador, una vez por hora
export const LOG_SIZE = 40;
