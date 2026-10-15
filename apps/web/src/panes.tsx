import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  affShare, canStart, closetSlots, HOME_BARRIO, TURF_BONUS, type Gang, COOP_ENERGY, COOP_MINS, forSale, SUPPLEMENT_MAX, supplementCost, supplementsTaken, DUEL_COST, ENCARGO_AFF, ENCARGO_COST, ENCARGOS, GANG_KEYS, GANGS, gangOf, GOLPES, guardiaTime, HOME, JOBS,
  trainTime, healCost, BOARD_REROLL_COST, findMission, meetsReq, missionEnergy, missionMins, missionNeed, missionReq, STREET_DIFF, itemLocked, maxHp, MIN_HP_TO_FIGHT, MISSIONS, money, nextLevel, RANK_NAMES, rankOf, RING, safeCap,
  SCOUT_COST, SHOP, STAT_HELP, STAT_NAMES, trainCost, VALIJA, BED_ENERGY, type Job, type Mission, type StatKey, type TabKey,
  ARCS, arcChapterKey, arcMissionId, arcOpen, clientOf, hasMod, hasVehicle, missionPlace, missionStepAt, MODS, modCost, needsTrip,
  POLICE_LVL, POV_COLOR, POV_NAME, POVS, PROP_CAP_HOURS, propIncome, PROPS, TRAVEL, TRAVEL_RISK, travelModes, tripCost, tripKm, tripMins,
  tripPhase, VEHICLES, type ModKey, type TravelMode, type Vehicle
} from "@pop/shared";
import { api, type BarrioView, type FriendsView, type RankRow, type RingView } from "./api";
import type { Ui } from "./Game";
import { avatarImg, bossImg, GangBadge, hasPortrait, img, Portrait, portraitOf, silhouette } from "./art";
import { ItemIcon } from "./icons";

const GpsMap = lazy(() => import("./gps/GpsMap"));
const mapFallback = <div className="gps" style={{ height: 260 }} />;

const riskTxt = ["", "bajo", "medio", "alto"];

export function Pane({ tab, ...rest }: Ui & { tab: TabKey }) {
  /* mientras entrenás o estás internado, todo lo que lleva energía o pelea queda bloqueado */
  const ui = { ...rest, busy: rest.busy || !!rest.s.busy };
  switch (tab) {
    case "laburos": return <Jobs {...ui} />;
    case "gimnasio": return <Gym {...ui} />;
    case "feria": return <Shop {...rest} />;
    case "ring": return <Ring {...ui} />;
    case "guardia": return <Hospital {...rest} />;
    case "misiones": return <Missions {...ui} />;
    case "calle": return <Street {...ui} />;
    case "casa": return <House {...rest} />;
    case "negocios": return <Business {...rest} />;
    case "amigos": return <Friends {...rest} />;
    case "ranking": return <Ranking {...ui} />;
  }
}

function Jobs({ s, act, busy }: Ui) {
  const row = (j: Job, label: string) => (
    <div className="item" key={j.id}>
      <div><h3>{j.name}<span className={`risk r${j.risk}`}>riesgo {riskTxt[j.risk]}</span></h3>
        <div className="meta num">{money(j.gold[0])}–{money(j.gold[1])} · {j.xp[0]}–{j.xp[1]} XP{j.resp ? ` · +${j.resp} respeto` : ""}{j.heat ? ` · +${j.heat} calor` : ""} · {j.cost} energía{s.lvl < j.lvl ? ` · desde nivel ${j.lvl}` : ""}</div></div>
      <div className="act"><button disabled={busy || s.energy < j.cost || s.lvl < j.lvl} onClick={() => act({ type: "job", id: j.id })}>{label}</button></div>
    </div>);
  return <>
    <h2>Trabajos</h2>
    <p>{s.tutDone ? "Encargos de las pandillas (cada uno suma afinidad con la que te lo da), golpes que pagan bien pero suman calor, y laburos honestos." : "Trabajos de todo tipo. Más riesgo, más plata. La labia te ayuda a cobrar mejor."}</p>
    {s.tutDone && <>
      <h3>Encargos de las pandillas</h3>
      <div className="list">{GANG_KEYS.map(g => {
        const e = ENCARGOS[g], info = GANGS[g];
        return <div className="item" key={g} style={{ borderLeft: `3px solid ${info.color}` }}>
          <div className="with-art"><Portrait src={bossImg(g)} gang={g} size={48} />
            <div><h3>{e.name}</h3>
              <div className="meta num"><span style={{ color: info.color }}>{info.name}</span> · prueba de {STAT_NAMES[e.stat].toLowerCase()} · +{ENCARGO_AFF} afinidad · {ENCARGO_COST} energía · vos: {Math.round(affShare(s, g) * 100)}%</div></div></div>
          <div className="act"><button disabled={busy || s.energy < ENCARGO_COST || s.hp < maxHp(s) * MIN_HP_TO_FIGHT} onClick={() => act({ type: "encargo", gang: g })}>Hacerlo</button></div>
        </div>;
      })}</div>
      <h3>Golpes</h3>
      <div className="list">{GOLPES.filter(j => j.lvl <= s.lvl + 2).map(j => row(j, "Hacerlo"))}</div>
      <h3>Laburos</h3>
    </>}
    <div className="list">{JOBS.filter(j => j.lvl <= s.lvl + 2).map(j => row(j, "Trabajar"))}</div>
  </>;
}

function Gym({ s, act, busy }: Ui) {
  return <>
    <div className="with-art">
      <Portrait src={img("retratos/tito")} size={72} />
      <div><h2>Gimnasio de Don Tito</h2><p className="say">«Cada punto cuesta más que el anterior, pibe, y lleva más tiempo. Mientras entrenás, no hacés otra cosa.»</p></div>
    </div>
    <div className="list">{(Object.keys(STAT_NAMES) as StatKey[]).map(k => {
      const c = trainCost(s.stats[k]);
      return <div className="item" key={k}>
        <div><h3>{STAT_NAMES[k]} <span className="num">{s.stats[k]}</span></h3><div className="meta">{STAT_HELP[k]}</div></div>
        <div className="act"><button disabled={busy || s.gold < c} onClick={() => act({ type: "train", stat: k })}>Entrenar · <span className="num">{money(c)} · {Math.round(trainTime(s.stats[k]) / 60000)} min</span></button></div>
      </div>;
    })}</div>
  </>;
}

function Shop({ s, act, busy }: Ui) {
  const items = SHOP.filter(it => forSale(s, it) && it.lvl <= s.lvl + 3 && (!it.rank || s.tutDone));
  return <>
    <h2>Feria de usados</h2>
    <p>{s.tutDone
      ? "Una cosa en la mano y una encima. Lo que dejás de usar va a tu armario si tenés lugar (si no, se queda en la feria). Cada nivel trae cosas nuevas; al fondo, el mercado negro, que se desbloquea subiendo de rango."
      : "Por ahora el puestero te vende una sola cosa: «Cuando Marga te dé el visto bueno, te muestro lo demás.»"}</p>
    <div className="list">{items.map(it => {
      const own = it.slot !== "consumible" && (s.gear[it.slot] === it.id || s.home.closet.includes(it.id));
      const sup = it.id === "suplemento", maxed = sup && supplementsTaken(s) >= SUPPLEMENT_MAX;
      const price = sup ? supplementCost(s) : it.price, locked = itemLocked(s, it);
      return <div className={`item ${locked ? "locked" : ""}`} key={it.id}>
        <div className="with-art"><ItemIcon id={it.id} /><div><h3>{it.name}{it.rank && <span className="badge" style={{ marginLeft: 6 }}>mercado negro</span>}</h3>
          <div className="meta num">{sup ? `Llevás ${supplementsTaken(s)} de ${SUPPLEMENT_MAX}` : it.slot === "consumible" ? "Se usa desde la clínica" : `${it.slot === "arma" ? "golpe" : "protección"} +${it.val}`} · {money(price)}
            {s.lvl < it.lvl && ` · se desbloquea en nivel ${it.lvl}`}{it.rank && rankOf(s) < it.rank ? ` · se desbloquea en rango ${RANK_NAMES[it.rank]}` : ""}</div></div></div>
        <div className="act"><button disabled={busy || own || maxed || s.gold < price || locked} onClick={() => act({ type: "buy", id: it.id })}>{own ? "Lo tenés" : maxed ? "Al máximo" : "Comprar"}</button></div>
      </div>;
    })}</div>
  </>;
}

function Ring(ui: Ui) {
  const { s, act, busy } = ui;
  return <>
    {s.tutDone && <Tournament {...ui} />}
    <h2>Peleas de práctica</h2>
    <p>Peleas de gimnasio. Cada una gasta 3 de energía. Si perdés, no perdés plata: solo orgullo.</p>
    <div className="list">{RING.map((m, i) => (
      <div className="item" key={m.name}>
        <div className="with-art"><Portrait src={silhouette(m.name)} silhouetteOf size={52} />
          <div><h3>{m.name}<span className={`risk r${m.mult < 0.9 ? 1 : m.mult < 1.3 ? 2 : 3}`}>×{m.mult.toFixed(1)}</span></h3>
          <div className="meta">{s.lvl < m.lvl ? `Pelea con gente de nivel ${m.lvl} para arriba` : m.lore}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < 3 || s.hp < 2 || s.lvl < m.lvl} onClick={() => act({ type: "spar", i })}>Pelear</button></div>
      </div>))}
    </div>
  </>;
}

/* Torneo mensual: una ronda suiza por día, se pelea solo */
function Tournament({ now, ping, refresh, toast }: Ui) {
  const [t, setT] = useState<RingView | null>(null);
  const load = () => api.ring().then(setT).catch(() => {});
  useEffect(() => { load(); }, [ping]);
  if (!t) return <p className="tag">Cargando el torneo…</p>;
  const hours = (ms: number) => { const h = Math.max(0, Math.round((ms - now) / 3_600_000)); return h < 1 ? "menos de una hora" : `${h} ${h === 1 ? "hora" : "horas"}`; };
  const best = t.history.length ? Math.min(...t.history.map(h => h.place)) : null;
  return <div className="thread" style={{ borderColor: "var(--sodium)" }}>
    <h2>Torneo del Ring · {t.seasonName}</h2>
    <p>Una ronda por día, a las 21 h. Te emparejan con alguien de tu mismo puntaje, sin repetir rival, y la pelea se resuelve sola con tus atributos y tu equipo (no hace falta estar conectado). Si hay pocos anotados, se suman boxeadores del barrio. Al cerrar el mes: premio para el podio y respeto para todos.</p>
    <p className="num">Ronda {t.done} de {t.rounds}{t.nextRoundAt ? ` · la próxima en ${hours(t.nextRoundAt)}` : ""} · cierra en {hours(t.closesAt)}</p>
    {!t.joined
      ? <div><button className="primary" onClick={() => api.ringJoin().then(() => { toast("Te anotaste en el torneo.", true); load(); refresh(); }).catch(e => toast(e.message))}>Anotarme gratis</button></div>
      : !!t.matches.length && <p>{t.matches.map(m => `R${m.round}: ${m.rival ? `${m.won ? "le ganaste a" : "perdiste con"} ${m.rival}` : "pasaste sin pelear"}`).join(" · ")}</p>}
    {t.table.some(r => !r.npc) && <ol className="ranking">{t.table.slice(0, 16).map(r => (
      <li key={`${r.name}-${r.place}`} className={r.me ? "me" : ""}>
        <span className="pos">{r.place}</span><span>{r.name}{r.npc && <span className="tag"> · del barrio</span>}</span>
        <span className="tag num">{r.wins}-{r.losses}</span><span className="num">{r.points} pts</span>
      </li>))}
    </ol>}
    {best && <p className="tag">Tu historial: {t.history.length} {t.history.length === 1 ? "torneo" : "torneos"} · mejor puesto: {best}º · {t.history.map(h => `${h.name}: ${h.place}º de ${h.entrants}`).join(" · ")}</p>}
    {!!t.champions.length && <p className="tag">Campeones: {t.champions.map(c => `${c.seasonName}: ${c.name}`).join(" · ")}</p>}
  </div>;
}

function Hospital({ s, act, busy }: Ui) {
  const c = healCost(s), full = s.hp >= maxHp(s), occupied = !!s.busy;
  return <>
    <h2>Clínica y guardia</h2>
    <p>La vida se recupera sola de a poco (de cero a lleno en media hora). Si no querés esperar, tenés dos opciones.</p>
    <div className="list">
      <div className="item"><div><h3>Clínica privada</h3><div className="meta num">{full ? "Estás entero" : `${money(c)} · al instante`}</div></div>
        <div className="act"><button disabled={busy || occupied || full || s.gold < c} onClick={() => act({ type: "heal" })}>Pagar y curarme</button></div></div>
      <div className="item"><div><h3>Guardia del hospital</h3><div className="meta num">{full ? "Estás entero" : `Gratis · te dan el alta en ${Math.max(1, Math.round(guardiaTime(s) / 60000))} min`} · mientras estás internado nadie te puede atacar</div></div>
        <div className="act"><button disabled={busy || occupied || full} onClick={() => act({ type: "guardia" })}>Internarme</button></div></div>
      <div className="item"><div><h3>Usar un botiquín</h3><div className="meta num">Tenés {s.potions} · +50% de vida</div></div>
        <div className="act"><button disabled={busy || !s.potions} onClick={() => act({ type: "kit" })}>Usar</button></div></div>
    </div>
  </>;
}

const STAT_SHORT: Record<StatKey, string> = { fue: "Fuerza", dur: "Dureza", ref: "Reflejos", agu: "Aguante", lab: "Labia" };
const DIFF_CLASS = ["r1", "r1", "r2", "r3"];

/* La misión en curso: etapas resueltas (✓ / ✗), la que viene y cuánto falta */
const kmTxt = (km: number) => (km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1).replace(".", ",")} km`);
const minTxt = (ms: number) => `${Math.max(1, Math.ceil(ms / 60000))} min`;

/* La misión en curso: el GPS con tu personaje y las etapas. Lo que todavía no pasó no se cuenta. */
function MissionProgress({ s, now }: Ui) {
  const b = s.busy;
  if (b?.kind !== "mision") return null;
  const m = findMission(s, b.id);
  if (!m) return null;
  const n = m.steps.length, res = b.res ?? [];
  const t = b.trip, ph = tripPhase(b, now);
  const arrived = !t || (t.ev & 1) === 1;
  const km = t ? tripKm(t.place, t.mode) : 0;
  return <div className="mission thread" style={{ borderColor: clientOf(m).color }}>
    <h3>En curso: {m.title}</h3>
    {t && ph && <>
      <Suspense fallback={mapFallback}>
        <GpsMap place={t.place} mode={t.mode} at={{ back: ph.phase === "vuelta", f: ph.frac }} avatar={avatarImg(s.avatar)} />
      </Suspense>
      <p className="gps-status num">{
        ph.phase === "ida" ? <>{TRAVEL[t.mode].name} a <b>{t.place}</b> · faltan {kmTxt(km * (1 - ph.frac))} · llegás en {minTxt(ph.left)}</> :
        ph.phase === "alla" ? <>En <b>{t.place}</b>, trabajando · después, {minTxt(t.back)} de vuelta</> :
        <>Volviendo a la pensión · faltan {kmTxt(km * (1 - ph.frac))} · {minTxt(ph.left)}</>}</p>
    </>}
    <ol className="steps">{m.steps.map((st, i) => {
      const past = i < b.done, current = i === b.done && arrived;
      return <li key={i} className={past ? (res[i] ? "ok" : "ko") : current ? "now" : "later"}>
        <span className="n">{past ? (res[i] ? "✓" : "✗") : i + 1}</span>
        {past ? <span>{(st.fight ? (res[i] ? st.win : st.lose) : res[i] ? st.ok : st.ko) ?? st.text}</span>
          : current ? <span>{st.text}<br /><span className="tag">se resuelve en {minTxt(missionStepAt(b, n, i) - now)}</span></span>
          : <span className="dash" aria-label="todavía no pasó" />}
      </li>;
    })}
    </ol>
    <p className="tag">Tienen que salir bien {missionNeed(m)} de {n} etapas. Lo que pasa queda en la crónica.</p>
  </div>;
}

/* Tarjeta de una misión: dónde es, duración, energía, requisitos y premio. Al salir, elegís cómo ir. */
function MissionCard({ m, s, act, busy, note, chip }: Ui & { m: Mission; note?: string; chip?: { name: string; color: string } }) {
  const [choosing, setChoosing] = useState(false);
  const req = Object.entries(missionReq(m)) as [StatKey, number][];
  const ok = canStart(s, m), meets = meetsReq(s, m), energy = missionEnergy(m);
  const done = !!s.done[m.id];
  const can = ok && meets && !s.busy && s.energy >= energy && s.hp >= maxHp(s) * 0.5;
  const place = missionPlace(m), trip = needsTrip(m) && place;
  const c = chip ?? (m.street ? clientOf(m) : undefined);
  const start = (mode?: TravelMode) => { setChoosing(false); act({ type: "mstart", id: m.id, mode }); };
  return <div className="item mission-card">
    <div><h3>{m.title}{m.street && <span className={`risk ${DIFF_CLASS[m.difficulty ?? 0]}`}>{STREET_DIFF[m.difficulty ?? 0].name}</span>}
        {c && <span className="client" style={{ color: c.color, borderColor: c.color }}>{c.name}</span>}</h3>
      <div className="meta">{done ? "Hecha." : m.street ? m.intro || null : m.intro}</div>
      {!done && <div className="meta num">
        {place && <>{place} · </>}{missionMins(m)} min{trip ? " + viaje" : ""} · {energy} energía
        {req.length > 0 && <> · pide {req.map(([k, v], i) => <span key={k} style={{ color: s.stats[k] < v ? "#eba09e" : undefined }}>{i ? ", " : ""}{STAT_SHORT[k]} {v}</span>)}</>}
        {m.reward && <> · {money(m.reward.gold)}, {m.reward.xp} XP, +{m.reward.resp} respeto</>}
        {m.reward?.heat && m.reward.heat < 0 ? <> · <b>−{-m.reward.heat} de calor</b></> : null}
        {m.street && m.gang && <> · +{m.aff} afinidad con <span style={{ color: GANGS[m.gang].color }}>{GANGS[m.gang].name}</span></>}
        {m.target && <> · <span style={{ color: GANGS[m.target].color }}>{GANGS[m.target].name}</span> pierde terreno y te quiere menos</>}
      </div>}
      {!done && note && <div className="lock">{note}</div>}
      {choosing && trip && <div className="travel">
        <div className="tag">¿Cómo vas hasta {place}? ({kmTxt(tripKm(place, "colectivo"))} desde la pensión)</div>
        {travelModes(s, place).map(k => {
          const cost = tripCost(s, k, place), mins = tripMins(s, k, place) * 2 + missionMins(m);
          return <button key={k} className="mode" disabled={busy || s.gold < cost} onClick={() => start(k)}>
            <b>{TRAVEL[k].name}</b><span className="num">{mins} min en total · {cost ? `${money(cost)} ida y vuelta` : "gratis"}</span><span className="tag">{TRAVEL_RISK[k]}</span>
          </button>;
        })}
        <button className="mode ghost" onClick={() => setChoosing(false)}>Mejor no</button>
      </div>}
    </div>
    <div className="act"><button className={can ? "primary" : ""} disabled={busy || !can || choosing}
      onClick={() => (trip ? setChoosing(true) : start())}>{done ? "Hecha" : "Salir"}</button></div>
  </div>;
}

function Missions(ui: Ui) {
  const { s, act, busy } = ui;
  if (!s.tutDone) return <>
    <h2>Misiones</h2>
    <p>Las misiones llevan tiempo de verdad: salís a hacerla y cada etapa se resuelve sola a su hora. Lo que pasa te lo cuenta la crónica.</p>
    <MissionProgress {...ui} />
    {!s.c.valija && !s.busy && <MissionCard m={VALIJA} {...ui} />}
  </>;
  const rk = rankOf(s), mine = gangOf(s);
  return <>
    <h2>Misiones</h2>
    <p>Llevan tiempo de verdad y piden atributos mínimos. Mientras estás en una, no podés hacer otra cosa. Las de calle se renuevan cada 6 horas; las de cada pandilla cuentan su historia y suman mucha afinidad.</p>
    <MissionProgress {...ui} />
    <div className="row-actions" style={{ justifyContent: "space-between" }}>
      <h3>Tablón de la calle</h3>
      <button disabled={busy || !!s.busy || s.energy < BOARD_REROLL_COST} onClick={() => act({ type: "reroll" })}>Buscar otras · {BOARD_REROLL_COST} energía</button>
    </div>
    <div className="list">{s.board.filter(m => !(s.busy?.kind === "mision" && s.busy.id === m.id)).map(m => <MissionCard key={m.id} m={m} {...ui} />)}</div>
    {s.lvl < POLICE_LVL && <p className="tag">Desde el nivel {POLICE_LVL}, el comisario Funes también deja trabajos sucios en el tablón.</p>}
    <Stories {...ui} />
    <h3>Las pandillas</h3>
    {GANG_KEYS.map(g => {
      const info = GANGS[g];
      return <div key={g} className="thread" style={{ borderColor: info.color }}>
        <div className="with-art"><Portrait src={bossImg(g)} gang={g} size={56} />
          <div><h3 style={{ color: info.color }}>{info.name}{mine === g && <span className="kind">tu pandilla</span>}</h3>
            <div className="meta">{info.boss} · {info.hood} · vos: {Math.round(affShare(s, g) * 100)}%</div></div></div>
        <div className="list">{MISSIONS[g].map((m: Mission) =>
          <MissionCard key={m.id} m={m} {...ui}
            note={canStart(s, m) ? undefined : rk < m.rank ? `Pide rango ${RANK_NAMES[m.rank]}` : "Primero terminá la anterior"} />)}</div>
      </div>;
    })}
  </>;
}

/* Historias de la ciudad: cada capítulo con un solo bando; el siguiente se abre al terminar el anterior */
function Stories(ui: Ui) {
  const { s } = ui;
  return <>
    <h3>Historias de la ciudad</h3>
    <p className="tag">El mismo hecho, contado desde cada bando. Cada capítulo lo hacés con uno solo: cuando sale bien, los otros bandos se cierran. El capítulo siguiente se abre cuando terminás el anterior.</p>
    {ARCS.map(arc => <div key={arc.id} className="thread arc">
      <h3>{arc.title}</h3>
      <div className="meta">{arc.blurb}</div>
      {arc.chapters.map((c, ch) => {
        const by = POVS.find(p => s.done[arcMissionId(arc.id, ch, p)]);
        const open = ch === 0 || !!s.done[arcChapterKey(arc.id, ch - 1)];
        return <div key={ch} className="chapter">
          <h4>Capítulo {ch + 1} · {open || by ? c.name : "???"} <span className="tag">{open || by ? `${c.place} · rango ${RANK_NAMES[c.rank]}` : ""}</span></h4>
          {by ? <div className="meta">Lo hiciste con <b style={{ color: POV_COLOR[by] }}>{POV_NAME[by]}</b>.</div>
            : !open ? <div className="meta">Se abre cuando termines el capítulo anterior.</div>
            : <div className="list">{POVS.map(p => {
                const m = findMission(s, arcMissionId(arc.id, ch, p))!;
                const note = p === "policia" && s.lvl < POLICE_LVL ? `Funes no te conoce todavía: nivel ${POLICE_LVL}.`
                  : rankOf(s) < m.rank ? `Pide rango ${RANK_NAMES[m.rank]}` : !arcOpen(s, m) ? "Cerrada" : undefined;
                return <MissionCard key={p} m={m} {...ui} note={note} chip={{ name: POV_NAME[p], color: POV_COLOR[p] }} />;
              })}</div>}
        </div>;
      })}
    </div>)}
  </>;
}

function Street({ s, act, busy }: Ui) {
  const weak = s.hp < maxHp(s) * MIN_HP_TO_FIGHT, mine = gangOf(s);
  return <>
    <h2>La calle</h2>
    <p>Pandilleros {mine ? `de las otras pandillas (a los de ${GANGS[mine].name} no los podés tocar)` : "de todas las pandillas: andás suelto, así que todos son rivales"}. Si ganás, te quedás con parte de lo que llevan encima. Cada pelea gasta {DUEL_COST} de energía. Los que dicen <span className="kind">jugador</span> son personas de verdad, y a vos también te pueden venir a buscar.</p>
    {weak && <p className="result bad">Estás muy golpeado para salir a pelear. Pasá por la guardia.</p>}
    <div className="list">{s.targets.map((t, i) => {
      const d = t.lvl - s.lvl;
      return <div className="item" key={`${t.name}-${i}`}>
        <div className="with-art">
          <Portrait src={t.kind === "player" ? avatarImg(t.avatar) : silhouette(t.name)} gang={t.gang} silhouetteOf={t.kind !== "player"} size={56} />
          <div><h3>{t.name}<span className={`risk r${d < 0 ? 1 : d < 2 ? 2 : 3}`}>nivel {t.lvl}</span>{t.kind === "player" && <span className="kind">jugador</span>}</h3>
          <div><GangBadge gang={t.gang} /></div>
          <div className="meta num">Lleva unos {money(t.gold)}</div></div></div>
        <div className="act"><button disabled={busy || s.energy < DUEL_COST || weak} onClick={() => act({ type: "duel", i })}>Atacar</button></div>
      </div>;
    })}</div>
    <div><button disabled={busy || s.energy < SCOUT_COST} onClick={() => act({ type: "scout" })}>Buscar a otros · {SCOUT_COST} energía</button></div>
  </>;
}

function Ranking({ s }: Ui) {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [map, setMap] = useState<{ map: BarrioView[]; owned: Record<Gang, number> } | null>(null);
  useEffect(() => {
    api.ranking().then(setRows).catch(() => setRows([]));
    api.territory().then(setMap).catch(() => {});
  }, [s.respect]);
  const mine = gangOf(s);
  const owners = useMemo(() => map && Object.fromEntries(map.map.map(b => [b.barrio, b.owner ? GANGS[b.owner].color : null])), [map]);
  return <>
    <h2>Maires</h2>
    <p>Cada barrio es de la pandilla con más influencia. La influencia la ganás trabajando para una pandilla (misiones, encargos, golpes y peleas) y se va gastando: pierde la mitad por semana. Cada barrio de tu pandilla te da +{Math.round(TURF_BONUS * 100)}% de plata.</p>
    {mine && map && <p className="result good">{GANGS[mine].name} controla {map.owned[mine]} {map.owned[mine] === 1 ? "barrio" : "barrios"}: +{map.owned[mine] * Math.round(TURF_BONUS * 100)}% de plata para vos.</p>}
    {owners && <Suspense fallback={mapFallback}><GpsMap owners={owners} height={300} /></Suspense>}
    {!map ? <p className="tag">Cargando el mapa…</p> :
      <div className="barrios">{map.map.map(b => {
        const total = GANG_KEYS.reduce((a, g) => a + b.points[g], 0) || 1;
        const c = b.owner ? GANGS[b.owner].color : "var(--line)";
        return <div key={b.barrio} className="barrio" style={{ borderColor: c, background: b.owner ? `linear-gradient(160deg, ${c}33, transparent 70%)` : undefined }}>
          <b>{b.barrio}</b>
          <span className="tag" style={{ color: b.owner ? c : undefined }}>{b.owner ? GANGS[b.owner].name : "En disputa"}</span>
          <div className="stack">{GANG_KEYS.map(g => <span key={g} title={`${GANGS[g].name}: ${b.points[g]}`} style={{ width: `${b.points[g] / total * 100}%`, background: GANGS[g].color }} />)}</div>
          {b.barrio === HOME_BARRIO[mine ?? "familia"] && mine && <span className="tag">el barrio de tu pandilla</span>}
        </div>;
      })}</div>}
    <h2>Ranking</h2>
    <p>Quién manda en Maires, de las cuatro pandillas. Se ordena por respeto.</p>
    {!rows ? <p className="tag">Cargando…</p> :
      <ol className="ranking">{rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className={r.me ? "me" : ""}>
          <span className="pos">{i + 1}</span>
          <span>{r.name} <GangBadge gang={r.gang} />{!r.npc && !r.me && <span className="kind">jugador</span>}</span>
          <span className="tag num">nivel {r.lvl}</span><span className="num">{r.resp}</span>
        </li>))}
      </ol>}
  </>;
}

/* Tu casa: cama (energía y descanso), caja fuerte (plata a salvo) y armario (equipo guardado) */
function House({ s, act, busy, now }: Ui) {
  const [amount, setAmount] = useState("");
  const o = s.home.obra;
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return <>
    <h2>Tu casa</h2>
    <p>Arrancaste en una pieza de pensión. Cada mejora cuesta plata y lleva un tiempo de obra; mientras tanto podés seguir haciendo tu vida. Una obra por vez.</p>
    {o && <p className="result good">Obra en curso: {HOME[o.part].levels[s.home[o.part] + 1].name} · faltan {Math.max(1, Math.ceil((o.until - now) / 60000))} min.</p>}
    <div className="list">{(Object.keys(HOME) as (keyof typeof HOME)[]).map(part => {
      const h = HOME[part], lv = s.home[part], next = nextLevel(s, part);
      return <div className="item" key={part}>
        <div><h3>{h.title}: {h.levels[lv].name}</h3><div className="meta">{h.help}
          {part === "cama" && ` Ahora: +${BED_ENERGY[lv]} de energía máxima.`}
          {part === "caja" && ` Capacidad: ${money(safeCap(s))}.`}
          {part === "armario" && ` Lugar: ${closetSlots(s)} cosas.`}
          {next && <><br /><span className="num">Siguiente: {next.name} · {money(next.cost)} · {next.mins} min de obra</span></>}</div></div>
        <div className="act">{next
          ? <button disabled={busy || !!o || s.gold < next.cost} onClick={() => act({ type: "build", part })}>Mejorar</button>
          : <span className="tag">al máximo</span>}</div>
      </div>;
    })}</div>

    {safeCap(s) > 0 && <>
      <h3>Caja fuerte</h3>
      <p>Tenés {money(s.home.safe)} guardados de {money(safeCap(s))}. Lo que está acá no te lo roban en la calle ni te lo sacan en una fianza.</p>
      <div className="row-actions">
        <input type="number" min={1} inputMode="numeric" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Monto" />
        <button disabled={busy || !n || !s.gold} onClick={() => { act({ type: "deposit", amount: n }); setAmount(""); }}>Guardar</button>
        <button disabled={busy || !s.gold} onClick={() => act({ type: "deposit", amount: s.gold })}>Guardar todo</button>
        <button disabled={busy || !n || !s.home.safe} onClick={() => { act({ type: "withdraw", amount: n }); setAmount(""); }}>Sacar</button>
      </div>
    </>}

    {closetSlots(s) > 0 && <>
      <h3>Armario ({s.home.closet.length} de {closetSlots(s)})</h3>
      {!s.home.closet.length ? <p>Vacío. Cuando compres algo nuevo, lo que tenías puesto viene acá.</p> :
        <div className="list">{s.home.closet.map(id => {
          const it = SHOP.find(i => i.id === id)!;
          return <div className="item" key={id}>
            <div className="with-art"><ItemIcon id={id} /><div><h3>{it.name}</h3><div className="meta num">{it.slot === "arma" ? "golpe" : "protección"} +{it.val}</div></div></div>
            <div className="act"><button disabled={busy} onClick={() => act({ type: "equip", id })}>Ponérmelo</button></div>
          </div>;
        })}</div>}
    </>}
  </>;
}

/* Amigos y misiones de a dos */
/* Negocios y garaje */
function Business({ s, act, busy, now }: Ui) {
  const owned = (id: string) => s.props?.[id] !== undefined;
  const pending = PROPS.reduce((a, p) => a + (owned(p.id) ? propIncome(p, s.props![p.id], now) : 0), 0);
  return <>
    <h2>Negocios</h2>
    <p>Comprás un negocio y deja plata por hora, aunque no estés. Hay que pasar a cobrarla: junta como mucho {PROP_CAP_HOURS} horas. Cada negocio trae sus propias misiones al tablón.</p>
    <div className="row-actions"><button className={pending ? "primary" : ""} disabled={busy || !pending} onClick={() => act({ type: "collect" })}>Cobrar {money(pending)}</button></div>
    <div className="list">{PROPS.map(p => {
      const mine = owned(p.id), locked = s.lvl < p.lvl;
      return <div className="item" key={p.id}>
        <div><h3>{p.name}{mine && <span className="kind">tuyo</span>}</h3>
          <div className="meta">{p.help} {p.place}.</div>
          <div className="meta num">{money(p.perHour)} por hora{p.heat ? ` · +${p.heat} de calor por cobro` : ""}
            {mine ? <> · juntó {money(propIncome(p, s.props![p.id], now))}</> : <> · {money(p.price)}</>}</div>
          {!mine && locked && <div className="lock">Pide nivel {p.lvl}</div>}</div>
        <div className="act">{!mine && <button disabled={busy || locked || s.gold < p.price} onClick={() => act({ type: "prop", id: p.id })}>Comprar</button>}</div>
      </div>;
    })}</div>
    <h3>Garaje</h3>
    <p>Con vehículo propio vas más rápido a las misiones, pero te ven llegar y te pueden parar en un control.{owned("taller") ? " Con tu taller, los arreglos salen 30% menos." : ""}</p>
    <div className="list">{(Object.keys(VEHICLES) as Vehicle[]).map(v => {
      const info = VEHICLES[v], has = hasVehicle(s, v), locked = s.lvl < info.lvl;
      return <div className="item" key={v}>
        <div><h3>{info.name}{has && <span className="kind">tuya</span>}</h3>
          <div className="meta">{info.help}</div>
          {!has && <div className="meta num">{money(info.price)}</div>}
          {!has && locked && <div className="lock">Pide nivel {info.lvl}</div>}
          {has && <div className="mods">{(Object.keys(MODS) as ModKey[]).filter(k => MODS[k].price[v]).map(k => {
            const done = hasMod(s, v, k), cost = modCost(s, MODS[k].price[v]!);
            return <button key={k} disabled={busy || done || s.gold < cost} onClick={() => act({ type: "mod", v, mod: k })}>
              {MODS[k].name}{done ? " ✓" : ` · ${money(cost)}`}<span className="tag">{MODS[k].help}</span></button>;
          })}</div>}</div>
        <div className="act">{!has && <button disabled={busy || locked || s.gold < info.price} onClick={() => act({ type: "vehicle", v })}>Comprar</button>}</div>
      </div>;
    })}</div>
  </>;
}

function Friends({ s, busy, ping, refresh, toast }: Ui) {
  const [data, setData] = useState<FriendsView | null>(null);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const load = () => api.friends().then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [ping]);
  /* toda acción: llamar, avisar el error si lo hay, y recargar amigos y personaje */
  const run = async (f: () => Promise<unknown>, ok?: string) => {
    setWorking(true);
    try { await f(); if (ok) toast(ok, true); }
    catch (e: any) { toast(e.message); }
    finally { setWorking(false); load(); refresh(); }
  };
  const off = busy || working;
  const c = s.coop;
  const coopMeta = (m: { mins?: number; reward?: { gold: number; xp: number } }) =>
    `${m.mins ?? COOP_MINS} min · ${COOP_ENERGY} de energía cada uno · ${money(m.reward?.gold ?? 0)} y ${m.reward?.xp ?? 0} XP para cada uno`;

  return <>
    <h2>Amigos</h2>
    <p>Agregá a tus amigos por su nombre en el juego. Con un amigo podés hacer misiones de a dos: pagan más, y arrancan cuando los dos estén libres.</p>
    <form className="row-actions" onSubmit={e => { e.preventDefault(); if (name.trim()) run(() => api.addFriend(name.trim()), "Solicitud enviada.").then(() => setName("")); }}>
      <input placeholder="Nombre de tu amigo" value={name} onChange={e => setName(e.target.value)} maxLength={20} aria-label="Nombre de tu amigo" />
      <button disabled={off || !name.trim()}>Agregar</button>
    </form>

    {c && <div className="thread" style={{ borderColor: "var(--sodium)" }}>
      <h3>Tu misión de a dos: {c.mission.title}</h3>
      <p className="meta">Con {c.partner} · {c.status === "waiting" ? "esperando a que los dos estén libres" : "en curso (mirá el avance arriba de tu vida)"} · {coopMeta(c.mission)}</p>
      <div><button className="link" disabled={off} onClick={() => run(() => api.coopCancel(c.id))}>{c.status === "waiting" ? "Cancelar (se devuelve la energía)" : "Abandonar"}</button></div>
    </div>}

    {!!data?.invites.length && <>
      <h3>Te invitaron</h3>
      <div className="list">{data.invites.map(i => (
        <div className="item" key={i.id}>
          <div><h3>{i.mission.title}</h3><div className="meta">{i.from} te invita · {coopMeta(i.mission)}</div></div>
          <div className="act">
            <button className="primary" disabled={off || !!c} onClick={() => run(() => api.coopRespond(i.id, true), "¡Aceptada! Arranca cuando los dos estén libres.")}>Aceptar</button>
            <button disabled={off} onClick={() => run(() => api.coopRespond(i.id, false))}>No puedo</button>
          </div>
        </div>))}</div>
    </>}

    {!!data?.incoming.length && <>
      <h3>Solicitudes de amistad</h3>
      <div className="list">{data.incoming.map(p => (
        <div className="item" key={p.id}>
          <div className="with-art"><Portrait src={avatarImg(p.avatar)} gang={p.gang} size={44} /><div><h3>{p.name}</h3><div className="meta">nivel {p.lvl}</div></div></div>
          <div className="act">
            <button className="primary" disabled={off} onClick={() => run(() => api.acceptFriend(p.id), `Ahora sos amigo de ${p.name}.`)}>Aceptar</button>
            <button disabled={off} onClick={() => run(() => api.removeFriend(p.id))}>Rechazar</button>
          </div>
        </div>))}</div>
    </>}

    <h3>Tus amigos</h3>
    {!data ? <p className="tag">Cargando…</p> : !data.friends.length ? <p>Todavía no agregaste a nadie.</p> :
      <div className="list">{data.friends.map(p => {
        const sent = data.sent.find(x => x.to === p.name);
        return <div className="item" key={p.id}>
          <div className="with-art"><Portrait src={avatarImg(p.avatar)} gang={p.gang} size={48} />
            <div><h3>{p.name} <span className={`live ${p.online ? "on" : ""}`} /></h3>
              <div className="meta">nivel {p.lvl} · <GangBadge gang={p.gang} /> · {p.online ? "en línea" : "desconectado"}</div>
              {sent && <div className="lock">Invitación enviada: {sent.mission.title}</div>}</div></div>
          <div className="act">{sent
            ? <button className="link" disabled={off} onClick={() => run(() => api.coopCancel(sent.id))}>Cancelar invitación</button>
            : <button disabled={off || !!c || !!data.sent.length} onClick={() => run(() => api.coopInvite(p.id), `Invitaste a ${p.name}.`)}>Misión de a dos</button>}
            <button className="link" disabled={off} onClick={() => run(() => api.removeFriend(p.id))}>Quitar</button>
          </div>
        </div>;
      })}</div>}

    {!!data?.outgoing.length && <p className="tag">Esperando respuesta: {data.outgoing.map(p => p.name).join(", ")}.</p>}
  </>;
}
