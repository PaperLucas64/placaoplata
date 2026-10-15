/* Historias de la ciudad: el mismo hecho contado desde cada pandilla (y desde la policía corrupta).
   Cada capítulo se juega con un solo bando: cuando sale bien, los demás bandos de ese capítulo se cierran.
   Los capítulos van en orden: el 2 se abre cuando terminaste el 1, desde el bando que sea. */
import { GANGS } from "./gangs.js";
import type { Gang, Mission, MissionStep, StatKey } from "./types.js";

export type Pov = Gang | "policia";
export const POVS: Pov[] = ["familia", "sindicato", "barra", "amarillos", "policia"];
export const COMISARIO = "el comisario Funes";
export const POV_NAME: Record<Pov, string> = {
  familia: GANGS.familia.name, sindicato: GANGS.sindicato.name, barra: GANGS.barra.name, amarillos: GANGS.amarillos.name, policia: "La 4ª (Funes)"
};
export const POV_COLOR: Record<Pov, string> = {
  familia: GANGS.familia.color, sindicato: GANGS.sindicato.color, barra: GANGS.barra.color, amarillos: GANGS.amarillos.color, policia: "#cfd6e2"
};
const bossOf = (p: Pov) => (p === "policia" ? COMISARIO : GANGS[p].boss);

type Check = [StatKey, string, string, string];           // atributo, qué hay que hacer, si sale bien, si sale mal
type Foe = [string, string, string, string];              // rival, situación, si ganás, si perdés
interface PovSpec { title: string; intro: string; a: Check; b: Check; foe: Foe; back: string; outro: string }
interface ChapterSpec { name: string; place: string; rank: number; diff: number; mins: number;
  reward: { gold: number; xp: number; resp: number; heat: number }; povs: Record<Pov, PovSpec> }
export interface Arc { id: string; title: string; blurb: string; chapters: ChapterSpec[] }

export const ARC_AFF = [10, 20, 30];          // afinidad con el bando elegido, por capítulo
export const ARC_INFLUENCE = [4, 6, 10];
export const ARC_POLICE_COOL = [20, 30, 40];  // calor que te baja Funes

export const ARCS: Arc[] = [
  { id: "clasico", title: "La semana del clásico",
    blurb: "Bocota Juniors contra Ríver Plateado. Toda la ciudad apuesta, viaja, cuelga trapos o cobra por mirar para otro lado.",
    chapters: [
      { name: "Trapos y apuestas", place: "Ñuñez", rank: 0, diff: 6, mins: 15, reward: { gold: 200, xp: 80, resp: 35, heat: 10 }, povs: {
        familia: { title: "El libro de apuestas",
          intro: "La Señora toma las apuestas del clásico en el bar de la esquina de la cancha. «Hay un apostador grande que se hace el distraído. Cobrale.»",
          a: ["lab", "Anotar las apuestas sin que el mozo nuevo se avive.", "El mozo cree que anotás pedidos.", "El mozo te mira la libreta. Tuviste que cambiar de mesa."],
          b: ["ref", "Alcanzar al apostador, que se escapa por los techos.", "Lo agarraste del cinturón antes de que salte.", "Se te escapó por la medianera."],
          foe: ["El primo del apostador", "El primo del apostador baja con un palo de escoba.", "El primo devuelve el palo y la plata.", "El primo te corre hasta la avenida."],
          back: "La Señora suma la columna dos veces y sonríe una.", outro: "«Ahora sabemos quién apuesta en contra de su propio club.»" },
        sindicato: { title: "Los micros de la visitante",
          intro: "Don Ramón Ferrante, el diarero de la esquina, controla los micros de la terminal. «Que la hinchada de Ríver Plateado llegue tarde. O que no llegue.»",
          a: ["fue", "Pinchar las gomas de los micros en el galpón.", "Doce micros, cuarenta y ocho gomas. Ni una sana.", "El sereno te escuchó y tuviste que esconderte bajo un micro."],
          b: ["lab", "Convencer a los choferes de que mañana están con fiebre.", "Mañana, casualmente, hay epidemia.", "Un chofer te dice que él no se enferma por nadie."],
          foe: ["El jefe de la terminal", "El jefe de la terminal te encuentra con el destornillador en la mano.", "El jefe de la terminal termina adentro del baúl de un micro.", "El jefe te saca de la terminal de una oreja."],
          back: "Don Ramón escucha la radio: «la hinchada visitante sigue varada». Se ríe atrás de una pila de diarios.", outro: "«Un paro es un paro, aunque sea de micros.»" },
        barra: { title: "El trapo de Ríver Plateado",
          intro: "El Tano Lucero no duerme. «Quiero el trapo grande de ellos colgado al revés en nuestra tribuna.»",
          a: ["ref", "Entrar de noche a la sede de Ríver Plateado.", "Pasaste por la ventana del baño.", "Te trabaste en la ventana del baño un buen rato."],
          b: ["fue", "Descolgar un trapo de cuarenta metros sin que se rompa.", "Lo bajaste doblado como una bandera de verdad.", "El trapo se te vino encima y te tapó entero."],
          foe: ["Un barra de Ríver Plateado", "Un barra de ellos duerme en la sede. Ya no duerme.", "El barra queda envuelto en su propio trapo chico.", "El barra te saca a los empujones."],
          back: "El Tano huele el trapo como si fuera un trofeo.", outro: "«El domingo lo van a ver al revés. Eso duele más que perder.»" },
        amarillos: { title: "Las entradas truchas",
          intro: "Rita Quiroga, taxista de toda la vida, tiene una imprenta y un plan. «Diez mil entradas que no existen. Nosotros las llevamos a la puerta.»",
          a: ["lab", "Convencer al imprentero de trabajar de noche.", "El imprentero prende las máquinas por el doble.", "El imprentero dice que tiene que pensarlo."],
          b: ["ref", "Repartir las entradas por los puestos antes del control.", "Las entradas llegan a todos los revendedores.", "Te cruzaste con el control y tuviste que tirar la mitad."],
          foe: ["Un revendedor de la competencia", "Un revendedor que no es de Rita te quiere sacar la caja.", "El revendedor se va con las manos vacías y un ojo morado.", "El revendedor se lleva un fajo."],
          back: "Rita cuenta la plata en el asiento de atrás de un taxi.", outro: "«Ese clásico se llenó dos veces.»" },
        policia: { title: "El operativo",
          intro: "El comisario Funes te cita en un bar lejos de la comisaría. «Quiero saber quién mueve las apuestas. Vos me lo contás y yo me olvido de tu cara.»",
          a: ["lab", "Infiltrarte en la tribuna como uno más.", "Cantaste todas las canciones. Nadie sospecha.", "No sabías la letra. Te miraron raro."],
          b: ["ref", "Sacarle fotos al que cobra las apuestas.", "Tenés tres fotos nítidas.", "Salieron todas movidas."],
          foe: ["Un barra que te descubre", "Un barra te ve con el teléfono en la mano.", "El barra se queda sin dientes y sin ganas de hablar.", "El barra te saca de la tribuna rodando."],
          back: "Funes mira las fotos y guarda una en el bolsillo de adentro.", outro: "«Esto vale mucho. Para mí. Vos cobrás lo tuyo y desaparecés.»" }
      } },
      { name: "El árbitro", place: "Villa Crespa", rank: 1, diff: 10, mins: 30, reward: { gold: 600, xp: 220, resp: 100, heat: 20 }, povs: {
        familia: { title: "Un sobre para el árbitro",
          intro: "«El árbitro del clásico tiene deudas. Nosotros tenemos plata. Que se encuentren.»",
          a: ["lab", "Darle el sobre al árbitro sin que lo vea su mujer.", "El árbitro guarda el sobre en el diario.", "La mujer abre la puerta antes que él."],
          b: ["dur", "Esperarlo toda la noche en el auto frente a su casa.", "A las seis de la mañana sale a pasear al perro. Es tu momento.", "Te dormiste y se te pasó."],
          foe: ["El custodio del árbitro", "El club le puso un custodio al árbitro.", "El custodio decide que no vio nada.", "El custodio te tira al piso y te saca el sobre."],
          back: "La Señora no pregunta. Sabe que el domingo hay penal.", outro: "«Los partidos se ganan antes de jugarse.»" },
        sindicato: { title: "Paro de utileros",
          intro: "«Si el partido no se juega, nadie pierde la plata que apostó. Y nosotros cobramos por levantar el paro.»",
          a: ["lab", "Convencer a los utileros de que paren.", "Los utileros cruzan los brazos.", "Los utileros quieren seguir trabajando."],
          b: ["fue", "Cortar la luz del estadio desde el tablero.", "El estadio queda a oscuras.", "Te dio la corriente. Fuerte."],
          foe: ["El jefe de seguridad del club", "El jefe de seguridad te encuentra en el tablero.", "El jefe de seguridad queda encerrado en el vestuario.", "El jefe de seguridad te saca a la calle."],
          back: "Don Ramón recibe una llamada del club: quieren negociar.", outro: "«¿Ves? Todos quieren negociar con nosotros.»" },
        barra: { title: "El aviso",
          intro: "El Tano quiere que el árbitro sepa lo que se juega. «Sin tocarlo. Que entienda solo.»",
          a: ["fue", "Dejarle el auto del árbitro sin espejos ni gomas.", "El auto queda apoyado en los ladrillos.", "Una alarma te hizo salir corriendo."],
          b: ["dur", "Aguantar a la custodia policial en la puerta de su casa.", "Cantaste toda la noche en su vereda.", "La custodia te corrió con los bastones."],
          foe: ["Un policía de la custodia", "Un policía de la custodia se te acerca con mala cara.", "El policía decide que su turno ya terminó.", "El policía te lleva hasta la esquina del cuello."],
          back: "El Tano escucha el relato y aplaude despacio.", outro: "«El domingo va a pitar con miedo. Eso nos alcanza.»" },
        amarillos: { title: "Un paseo largo",
          intro: "Rita tiene una idea: «El día del partido lo pasamos a buscar en un remís. Y lo paseamos. Mucho.»",
          a: ["lab", "Hacerte pasar por el remisero de la liga.", "El árbitro sube al auto sin dudar.", "El árbitro llama a la liga para confirmar. Cortaste justo."],
          b: ["ref", "Perder al auto de la custodia en el tránsito.", "La custodia se queda en un semáforo de Villa Crespa.", "La custodia te sigue tres avenidas."],
          foe: ["El juez de línea", "El juez de línea sospechó y se subió al auto en un semáforo.", "El juez de línea se baja en la próxima esquina, sin bandera.", "El juez de línea abre la puerta y se lleva al árbitro."],
          back: "Rita pone la radio: el partido se suspendió por falta de árbitro.", outro: "«Llegar tarde también es un arte.»" },
        policia: { title: "Custodia paga",
          intro: "Funes cobra de los dos lados: «Me pagaron para que al árbitro no le pase nada. Y me pagaron para que le pase algo. Vos cuidalo. Es lo más caro.»",
          a: ["ref", "Detectar a los que siguen al árbitro.", "Tenés las patentes de dos autos.", "No viste a nadie y había tres."],
          b: ["dur", "Hacer guardia en su puerta toda la noche.", "La noche pasó sin novedades.", "Te comiste la lluvia de punta a punta."],
          foe: ["Un matón de la barra", "Un matón de la barra viene a dejar un mensaje.", "El mensaje no llegó. El matón tampoco.", "El matón te pasa por arriba."],
          back: "Funes cobra el segundo sobre y te da una parte.", outro: "«Mientras todos se odien, nosotros cobramos.»" }
      } },
      { name: "La revancha en Rosarito", place: "Salida", rank: 2, diff: 15, mins: 45, reward: { gold: 1500, xp: 550, resp: 250, heat: 30 }, povs: {
        familia: { title: "El casino de Rosarito",
          intro: "La revancha se juega en Rosarito. La Señora quiere aprovechar: «Lo que juntamos en apuestas, lo lavamos en el casino. Viajá.»",
          a: ["lab", "Entrar a la sala VIP del casino.", "El de la puerta te confunde con un empresario.", "Te piden la tarjeta de socio. No tenés."],
          b: ["ref", "Cambiar las fichas antes de que cierre la caja.", "Las fichas vuelven convertidas en cheques limpios.", "La caja cerró en tu cara."],
          foe: ["El jefe de seguridad del casino", "El jefe de seguridad te invita a una oficina sin ventanas.", "Salís de la oficina. Él no.", "Te sacan por la puerta de atrás."],
          back: "Volvés a Maires con un sobre lleno de cheques.", outro: "«En Rosarito saben contar plata. Nosotros, también.»" },
        sindicato: { title: "Los camiones de la hinchada",
          intro: "«Llevamos a la hinchada en camiones del gremio. Y abajo de los asientos va otra cosa. Que lleguen todos.»",
          a: ["dur", "Manejar toda la noche por la ruta 9.", "Llegaste con el sol.", "Te dormiste un segundo y te comiste la banquina."],
          b: ["lab", "Pasar el control de Gendarmería.", "El gendarme es afiliado. Pasaste.", "El gendarme quiere revisar los asientos."],
          foe: ["Un gendarme que quiere revisar", "Un gendarme se sube al camión con una linterna.", "El gendarme se baja con la linterna rota.", "El gendarme te hace bajar a todos."],
          back: "Don Ramón cuenta los camiones en el galpón. Están todos.", outro: "«La ruta es nuestra. Siempre lo fue.»" },
        barra: { title: "El trapo vuelve",
          intro: "El Tano quiere el golpe final: «El trapo de ellos lo colgamos en su propia cancha, en Rosarito, frente a todos.»",
          a: ["fue", "Meter el trapo en la tribuna enrollado en el cuerpo.", "Pasaste el cacheo con cuarenta metros de tela encima.", "En el cacheo te hicieron sacar la campera."],
          b: ["dur", "Aguantar la avalancha cuando lo desplegás.", "El trapo queda colgado al revés. La tribuna rival enmudece.", "La avalancha te aplasta contra el alambrado."],
          foe: ["El jefe de la barra rival", "El jefe de la barra de Ríver Plateado baja a buscarte.", "El jefe de ellos vuelve a su tribuna sin voz.", "El jefe de ellos te saca a trompadas."],
          back: "El Tano llora en la ruta de vuelta. De alegría.", outro: "«Esto lo van a cantar nuestros nietos.»" },
        amarillos: { title: "Los únicos remises",
          intro: "«Cuando termine el partido, en Rosarito no va a haber un solo taxi. Solo los nuestros. Y van a cobrar lo que quieran.»",
          a: ["ref", "Sacar los autos del estacionamiento antes que la policía lo cierre.", "Los remises salen en fila.", "Quedaron la mitad adentro."],
          b: ["lab", "Cobrar el viaje en efectivo y por adelantado.", "Todos pagan triple sin chistar.", "Medio pasaje se bajó sin pagar."],
          foe: ["Un patovica que se quiere colar", "Un patovica quiere viajar gratis.", "El patovica viaja en el baúl, y paga.", "El patovica se queda con el auto."],
          back: "Rita recibe la recaudación en una ruta oscura.", outro: "«Cada partido tiene un ganador. Esta vez fuimos nosotros.»" },
        policia: { title: "La entrega",
          intro: "Funes quiere los capos de las apuestas. «Los voy a entregar a la federal. Vos marcame la camioneta con la plata y te borro el prontuario.»",
          a: ["lab", "Ganarte la confianza del corredor de apuestas.", "El corredor te invita a su mesa.", "El corredor no te mira."],
          b: ["ref", "Marcar la camioneta con la plata.", "El rastreador queda pegado abajo del paragolpes.", "El rastreador se te cayó en un charco."],
          foe: ["El corredor de apuestas", "El corredor te descubre cerca de la camioneta.", "El corredor termina esposado al volante.", "El corredor te pega con el gato hidráulico."],
          back: "Funes sale en el noticiero. Vos no.", outro: "«Vos y yo, socio. Nadie más tiene que saberlo.»" }
      } }
    ] },
  { id: "riobravo", title: "El Río Bravo",
    blurb: "Un carguero de Montevideo llega a Puerto Mareo con un contenedor que nadie declaró. Todos lo quieren. Nadie sabe qué tiene adentro.",
    chapters: [
      { name: "Llega el barco", place: "Puerto Mareo", rank: 1, diff: 8, mins: 15, reward: { gold: 400, xp: 150, resp: 70, heat: 15 }, povs: {
        familia: { title: "Recibir la carga",
          intro: "«El contenedor es nuestro. Que pase la aduana y llegue al depósito. No me importa qué tiene adentro.»",
          a: ["lab", "Arreglar con el aduanero.", "El aduanero sella todo sin abrir nada.", "El aduanero quiere ver los papeles."],
          b: ["ref", "Sacar el contenedor del muelle antes del cambio de turno.", "La grúa lo baja justo a tiempo.", "El turno nuevo llegó antes."],
          foe: ["Un estibador de El Sindicato", "Un estibador del Sindicato no deja salir el camión.", "El estibador se sienta en el cordón a pensar.", "El estibador te hace volver con el camión."],
          back: "La Señora mira el contenedor por la ventana del depósito.", outro: "«Ahora averiguá qué hay adentro.»" },
        sindicato: { title: "Sin tajada no se descarga",
          intro: "«En el puerto nada se descarga sin que el gremio cobre. Que lo sepan.»",
          a: ["lab", "Parar las grúas del muelle 4.", "Las grúas quedan quietas como estatuas.", "Un gruista no quiere parar."],
          b: ["fue", "Cerrar el portón del puerto con una cadena.", "La cadena aguanta.", "La cadena se cortó al primer tirón."],
          foe: ["Un custodio de La Familia", "Un custodio de La Familia viene a abrir el portón.", "El custodio se vuelve sin la llave.", "El custodio corta la cadena delante tuyo."],
          back: "Don Ramón cobra su parte en un sobre marrón.", outro: "«Ahora queremos saber qué hay adentro.»" },
        barra: { title: "Cuidar el muelle",
          intro: "«Nos pagan por cuidar el muelle esta noche. Cuidalo. Y mirá bien qué pasa.»",
          a: ["dur", "Hacer guardia en el muelle bajo la lluvia.", "Aguantaste la noche entera.", "Te agarró un resfrío de los buenos."],
          b: ["ref", "Seguir a los que se acercan al contenedor.", "Viste quién tenía la llave.", "Los perdiste entre los contenedores."],
          foe: ["Un ladrón de contenedores", "Un ladrón quiere abrir el contenedor.", "El ladrón termina en el agua.", "El ladrón te tira al agua a vos."],
          back: "El Tano anota lo que viste en una servilleta.", outro: "«Así que eso tenían. Interesante.»" },
        amarillos: { title: "El camión sin luces",
          intro: "«Llevamos el contenedor por la costanera. Sin luces y sin preguntas. Cobramos de todos.»",
          a: ["ref", "Manejar el camión por la costanera sin luces.", "Llegaste sin rozar un cordón.", "Te llevaste puesto un poste de luz."],
          b: ["lab", "Pasar el control de la Prefectura con papeles prestados.", "El prefecto te deja pasar.", "El prefecto llama a su jefe."],
          foe: ["Un prefecto", "Un prefecto se sube al estribo del camión.", "El prefecto se baja en la curva.", "El prefecto te hace frenar."],
          back: "Rita cobra el viaje tres veces: una por cada interesado.", outro: "«Llevar es poder.»" },
        policia: { title: "Ojos en el muelle",
          intro: "«La comisaria Ríos quiere ese barco. Yo quiero saber antes que ella quién lo recibe.»",
          a: ["ref", "Fotografiar a los que reciben el contenedor.", "Tenés las caras de todos.", "Las fotos salieron oscuras."],
          b: ["lab", "Sacarle el manifiesto de carga al capitán.", "El capitán te lo vende por una botella.", "El capitán no habla castellano. Ni ganas."],
          foe: ["El capitán del Río Bravo", "El capitán se da cuenta de lo que hiciste.", "El capitán vuelve a su camarote.", "El capitán te tira por la escalerilla."],
          back: "Funes lee el manifiesto y se pone pálido.", outro: "«Esto no son electrodomésticos. Esto es dinamita política.»" }
      } },
      { name: "Lo que había adentro", place: "La Paterna", rank: 2, diff: 13, mins: 30, reward: { gold: 1100, xp: 380, resp: 170, heat: 25 }, povs: {
        familia: { title: "La caja del intendente",
          intro: "Adentro del contenedor había una caja fuerte con los libros del intendente Ramírez. «Eso vale más que el puerto. Guardala donde nadie la encuentre.»",
          a: ["fue", "Cargar una caja fuerte de doscientos kilos.", "La subiste a la camioneta con la espalda sana.", "Se te cayó en el pie."],
          b: ["lab", "Convencer al dueño del depósito de que no vio nada.", "El dueño del depósito se va de vacaciones.", "El dueño del depósito llama a su abogado."],
          foe: ["Un ladrón de El Sindicato", "Uno del Sindicato entra al depósito de noche.", "El del Sindicato sale sin la caja.", "El del Sindicato se lleva la mitad de los papeles."],
          back: "La Señora guarda la llave colgada del cuello.", outro: "«Con esto, el intendente trabaja para nosotros.»" },
        sindicato: { title: "El robo del depósito",
          intro: "«La Familia tiene la caja en un depósito de La Paterna. A dos cuadras de nuestros galpones. Es nuestra.»",
          a: ["ref", "Entrar por los techos del depósito.", "Bajaste por la claraboya sin ruido.", "La chapa crujió y despertó a medio barrio."],
          b: ["fue", "Romper el candado de la jaula.", "El candado cede.", "El candado aguanta más que vos."],
          foe: ["El sereno del depósito", "El sereno tiene una escopeta y poco sueño.", "El sereno se queda dormido de golpe.", "El sereno te saca a escopetazos al aire."],
          back: "Don Ramón abre la caja con un soplete y lee en silencio.", outro: "«El intendente va a firmar lo que queramos.»" },
        barra: { title: "Por la cancha",
          intro: "«En esos libros está la venta de nuestra cancha. Si los conseguimos, el club no se vende.»",
          a: ["lab", "Averiguar dónde está la caja.", "Un hincha que trabaja en el depósito te pasa el dato.", "Nadie sabe nada. O no quieren saber."],
          b: ["dur", "Aguantar la paliza de los custodios para distraerlos.", "Mientras te pegan, los pibes sacan la caja.", "Te pegaron y no sirvió de nada."],
          foe: ["Un custodio de La Familia", "Un custodio de La Familia cuida la puerta.", "El custodio queda tirado en la vereda.", "El custodio te deja tirado a vos."],
          back: "El Tano abraza la caja como si fuera la copa.", outro: "«La cancha es del barrio. Para siempre.»" },
        amarillos: { title: "El traslado",
          intro: "«Mueven la caja de un depósito a otro. En el camino, la camioneta va a doblar donde nosotros digamos.»",
          a: ["ref", "Seguir la camioneta sin que te vean.", "Ibas tres autos atrás todo el tiempo.", "El chofer te vio en el espejo."],
          b: ["fue", "Cruzarle un taxi en la esquina.", "La camioneta frena en seco.", "La camioneta te esquiva y sigue."],
          foe: ["El chofer de la camioneta", "El chofer baja con un fierro.", "El chofer se va caminando.", "El chofer arranca y te deja en el piso."],
          back: "Rita esconde la caja en el baúl de un taxi que no existe.", outro: "«El que tiene la caja maneja la ciudad.»" },
        policia: { title: "El allanamiento",
          intro: "«La comisaria Ríos va a allanar el depósito mañana. Nosotros entramos hoy. La caja es mía.»",
          a: ["lab", "Conseguir la orden firmada por un juez dormido.", "El juez firma en pijama.", "El juez se despertó del todo y preguntó."],
          b: ["ref", "Entrar primero, antes que la comisaria Ríos.", "Llegaste diez minutos antes.", "Ríos ya estaba en la puerta."],
          foe: ["Un pandillero armado", "Un pandillero cuida la caja.", "El pandillero queda esposado a un caño.", "El pandillero se escapa con la caja."],
          back: "Funes guarda la caja en su casa, no en la comisaría.", outro: "«Ahora el intendente me debe a mí.»" }
      } },
      { name: "El intendente", place: "Reloquita", rank: 3, diff: 19, mins: 45, reward: { gold: 2600, xp: 900, resp: 380, heat: 40 }, povs: {
        familia: { title: "La firma",
          intro: "«El intendente Ramírez da una fiesta en Reloquita. Vas a llevarle una copia de sus libros y una lapicera.»",
          a: ["lab", "Entrar a la fiesta de la embajada.", "Entraste con un saco prestado y mucha cara.", "El de la puerta no te encontró en la lista."],
          b: ["dur", "Aguantar la mirada del intendente mientras lee.", "El intendente firma. Le tiembla la mano.", "Pestañeaste primero."],
          foe: ["El guardaespaldas del intendente", "El guardaespaldas te quiere sacar de la fiesta.", "El guardaespaldas termina en la fuente.", "El guardaespaldas te saca a la calle."],
          back: "La Señora enmarca el decreto firmado.", outro: "«Desde hoy, el municipio es una sucursal de la Familia.»" },
        sindicato: { title: "El convenio",
          intro: "«Mil afiliados en la puerta de la casa del intendente, hasta que firme el convenio. Vos los dirigís.»",
          a: ["lab", "Llevar a mil afiliados a Reloquita.", "Mil personas, bombos y choripán en la vereda más cara de Maires.", "Vinieron cuarenta."],
          b: ["fue", "Bancar la puerta contra la Guardia de Infantería.", "La puerta queda de tu lado.", "La Guardia te pasa por encima."],
          foe: ["El jefe de la Guardia de Infantería", "El jefe de la Guardia te busca a vos, el que dirige.", "El jefe de la Guardia se retira con su gente.", "El jefe de la Guardia te sube a un camión."],
          back: "Don Ramón sale al balcón con el convenio firmado.", outro: "«Esto es historia del movimiento obrero. Más o menos.»" },
        barra: { title: "La cancha no se vende",
          intro: "«Entrás a la casa del intendente, le dejás los libros en la almohada y te vas. Que entienda.»",
          a: ["fue", "Trepar la reja de la casa del intendente.", "Pasaste la reja con la campera rota.", "La reja te ganó."],
          b: ["dur", "Esperar escondido en el placard a que se duerma.", "A las tres de la mañana ronca.", "Te dio un calambre y tiraste las perchas."],
          foe: ["Los dobermans del intendente", "Los dobermans te encontraron.", "Los dobermans terminan comiendo de tu mano.", "Los dobermans te corren hasta la avenida."],
          back: "El intendente anuncia por radio que la cancha no se vende.", outro: "«Hay cosas que no tienen precio. Y si lo tienen, lo pagamos nosotros.»" },
        amarillos: { title: "El pasajero más caro",
          intro: "«Ramírez quiere irse del país antes de que salgan sus libros. Pagó una fortuna. Lo sacamos nosotros.»",
          a: ["ref", "Recogerlo en la puerta trasera sin que lo vean.", "El intendente sube con una valija y lentes negros.", "Los vecinos lo reconocen y empiezan a gritar."],
          b: ["lab", "Pasar los controles con el intendente en el baúl.", "Pasaste tres controles saludando.", "En un control te piden abrir el baúl."],
          foe: ["Los custodios de la oposición", "La oposición también lo busca.", "Los de la oposición quedan mirando las luces del taxi.", "La oposición te bloquea la calle."],
          back: "Rita guarda la valija del intendente. Él ya no la necesita.", outro: "«En Maires todos viajan. Algunos más lejos que otros.»" },
        policia: { title: "La detención",
          intro: "«Con los libros, Ramírez cae. Yo me llevo la medalla y vos la recompensa. Hoy se termina.»",
          a: ["lab", "Convencer al fiscal de firmar la detención.", "El fiscal firma con una sonrisa.", "El fiscal quiere esperar a mañana."],
          b: ["ref", "Rodear la casa sin que se escape.", "Todas las salidas cerradas.", "Se escapó por el garaje."],
          foe: ["El custodio personal del intendente", "El custodio del intendente se planta en la puerta.", "El custodio entrega el arma.", "El custodio te tira por la escalera."],
          back: "Funes sale en todos los diarios. Vos cobrás en efectivo.", outro: "«El que se queda con los libros se queda con la ciudad. Gracias, socio.»" }
      } }
    ] }
];

/* arma la misión de un capítulo, desde un bando */
export const arcMissionId = (arc: string, ch: number, pov: Pov) => `${arc}-${ch}-${pov}`;
export const arcChapterKey = (arc: string, ch: number) => `${arc}#${ch}`;
function build(arc: Arc, ch: number, pov: Pov): Mission {
  const c = arc.chapters[ch], p = c.povs[pov];
  const step = ([stat, text, ok, ko]: Check, diff: number): MissionStep => ({ text, stat, diff, energy: 2 + ch, dmg: 0.1, ok, ko });
  const [name, text, win, lose] = p.foe;
  return {
    id: arcMissionId(arc.id, ch, pov), arc: arc.id, chapter: ch, pov, rank: c.rank, mins: c.mins, place: c.place,
    gang: pov === "policia" ? undefined : pov, client: pov === "policia" ? "policia" : undefined,
    title: p.title, intro: p.intro, outro: p.outro,
    req: { [p.a[0]]: c.diff + 1, ...(p.b[0] !== p.a[0] ? { [p.b[0]]: c.diff } : {}) },
    aff: pov === "policia" ? 0 : ARC_AFF[ch],
    steps: [step(p.a, c.diff), step(p.b, c.diff),
      { text, fight: { name, mult: 0.85 + ch * 0.05 }, energy: 3 + ch, win, lose },
      { text: `Volver con ${bossOf(pov)}.`, energy: 1, auto: true, ok: p.back }],
    reward: pov === "policia" ? { ...c.reward, gold: Math.round(c.reward.gold * 0.8), heat: -ARC_POLICE_COOL[ch] } : c.reward
  };
}
export const ARC_MISSIONS: Mission[] = ARCS.flatMap(a => a.chapters.flatMap((_, ch) => POVS.map(p => build(a, ch, p))));
export const arcOf = (id: string) => ARCS.find(a => a.id === id);
