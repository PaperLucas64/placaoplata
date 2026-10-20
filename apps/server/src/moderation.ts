/* Palabras que no van en Buenos Aires: insultos racistas, xenófobos, homofóbicos, transfóbicos, capacitistas y nazis.
   Se usan en el chat y en los nombres de personaje. Los insultos de todos los días ("boludo", "forro") no se frenan:
   lo que se frena es discriminar. Para agregar una palabra, sumala a la lista que corresponda (en minúscula, sin tildes).

   El texto se "normaliza" antes de comparar, para que no se pueda esquivar el filtro:
   sin tildes, números por letras (n3gr0 → negro), sin letras estiradas (puuuto → puto) y sin espacios entre letras (n e g r o). */

/* palabras sueltas: se frenan solas (también en plural) */
const WORDS = [
  // racismo y xenofobia
  /* ojo con las que también son palabras comunes: "bolita" (canica), "chilote" (de Chiloé), "Kike" (Enrique) o "sambo" (un deporte)
     solo se frenan como insulto armado ("bolita de mierda") */
  "sudaca", "sudacas", "bolita de mierda", "bolitas de mierda", "paragua", "perucho", "peruca", "yorugua de mierda",
  "negrada", "negrata", "negroide", "cabecita negra", "villero de mierda",
  "nigger", "nigga", "niga", "negro de mierda", "negros de mierda", "negra de mierda", "negras de mierda", "mono de mierda",
  "spic", "chink", "wetback", "beaner", "gook",
  "judio de mierda", "judios de mierda", "rata judia", "ratas judias",
  "chino de mierda", "chinos de mierda", "boliviano de mierda", "bolivianos de mierda", "paraguayo de mierda", "paraguayos de mierda",
  "peruano de mierda", "peruanos de mierda", "chileno de mierda", "chilenos de mierda", "venezolano de mierda", "venecos",
  "veneco", "turco de mierda", "gitano de mierda", "gitanos de mierda", "indio de mierda", "indios de mierda", "coya de mierda",
  // homofobia y transfobia
  "puto", "putos", "putito", "putitos", "trolo", "trolos", "trolazo", "maricon", "maricones", "marica", "maricas", "mariconazo",
  "torta de mierda", "tortillera", "tortilleras", "travesti de mierda", "trava de mierda", "travuco",
  "faggot", "fag", "fags", "dyke", "tranny", "trannies",
  // capacitismo
  "mogolico", "mogolicos", "mogolica", "mogolicas", "retrasado mental", "retrasada mental", "retard", "retarded", "subnormal",
  // nazismo
  "heil hitler", "sieg heil", "1488", "14 88", "88 heil", "white power", "poder blanco", "raza superior", "zyklon"
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "i" };

/* minúscula, sin tildes, números por letras, solo letras y espacios, sin letras repetidas */
function norm(text: string, keepDigits = false): string {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const leet = keepDigits ? t : t.replace(/[0134578@$!|]/g, c => LEET[c] ?? c);
  return leet.replace(keepDigits ? /[^a-z0-9ñ]+/g : /[^a-zñ]+/g, " ").replace(/(.)\1+/g, "$1").trim();
}

const PHRASES = WORDS.map(w => ({ spaced: ` ${norm(w)} `, joined: norm(w).replace(/ /g, ""), phrase: / /.test(w) && !/\d/.test(w),
  digits: /\d/.test(w) ? ` ${norm(w, true)} ` : null }));

/* ¿el texto tiene algo de la lista? */
export function isBlocked(text: string): boolean {
  const digits = ` ${norm(text, true)} `;
  /* se prueba con números y signos cambiados por letras (m4r1c0n) y sin cambiar ("¡maricón!", donde el signo no es una letra) */
  return [norm(text), norm(text.replace(/[!|$@]/g, " "))].some(n => {
    const spaced = ` ${n} `, joined = n.replace(/ /g, "");
    /* letras sueltas separadas ("n e g r o"): se juntan las tiradas de letras de a una */
    const glued = ` ${n.replace(/\b(\w) (?=\w\b)/g, "$1")} `;
    /* las frases también se buscan todo pegado ("negrodemierda"); las palabras sueltas no, porque están adentro de otras ("paraguas") */
    return PHRASES.some(p =>
      spaced.includes(p.spaced) || glued.includes(p.spaced) || (p.digits && digits.includes(p.digits)) ||
      (p.phrase && joined.includes(p.joined)));
  });
}
