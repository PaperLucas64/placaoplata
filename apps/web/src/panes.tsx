import { useEffect, useState } from "react";
import {
  affShare, canStart, closetSlots, forSale, SUPPLEMENT_MAX, supplementCost, supplementsTaken, DUEL_COST, ENCARGO_AFF, ENCARGO_COST, ENCARGOS, GANG_KEYS, GANGS, gangOf, GOLPES, guardiaTime, HOME, JOBS,
  trainTime, healCost, BOARD_REROLL_COST, findMission, meetsReq, missionEnergy, missionMins, missionNeed, missionReq, STREET_DIFF, itemLocked, maxHp, MIN_HP_TO_FIGHT, MISSIONS, money, nextLevel, RANK_NAMES, rankOf, RING, safeCap,
  SCOUT_COST, SHOP, STAT_HELP, STAT_NAMES, trainCost, VALIJA, BED_ENERGY, type Job, type Mission, type StatKey, type TabKey
} from "@pop/shared";
import { api, type RankRow } from "./api";
import type { Ui } from "./Game";
import { avatarImg, bossImg, GangBadge, hasPortrait, img, Portrait, portraitOf, silhouette } from "./art";
import { ItemIcon } from "./icons";

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

function Ring({ s, act, busy }: Ui) {
  return <>
    <h2>El ring</h2>
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
function MissionProgress({ s, now }: Ui) {
  const b = s.busy;
  if (b?.kind !== "mision") return null;
  const m = findMission(s, b.id);
  if (!m) return null;
  const n = m.steps.length, res = b.res ?? [];
  return <div className="mission thread" style={{ borderColor: m.gang ? GANGS[m.gang].color : "var(--sodium)" }}>
    <h3>En curso: {m.title}</h3>
    <ol className="steps">{m.steps.map((st, i) => (
      <li key={i} className={i < b.done ? (res[i] ? "ok" : "ko") : i === b.done ? "now" : ""}>
        <span className="n">{i < b.done ? (res[i] ? "✓" : "✗") : i + 1}</span>
        <span>{st.text}{i === b.done && <><br /><span className="tag">se resuelve en {Math.max(1, Math.ceil((b.since + (b.until - b.since) * (i + 1) / n - now) / 60000))} min</span></>}</span>
      </li>))}
    </ol>
    <p className="tag">Tienen que salir bien {missionNeed(m)} de {n} etapas. Lo que pasa queda en la crónica.</p>
  </div>;
}

/* Tarjeta de una misión: duración, energía, requisitos y premio */
function MissionCard({ m, s, act, busy, note }: Ui & { m: Mission; note?: string }) {
  const req = Object.entries(missionReq(m)) as [StatKey, number][];
  const ok = canStart(s, m), meets = meetsReq(s, m), energy = missionEnergy(m);
  const done = !!s.done[m.id];
  const can = ok && meets && !s.busy && s.energy >= energy && s.hp >= maxHp(s) * 0.5;
  return <div className="item">
    <div><h3>{m.title}{m.street && <span className={`risk ${DIFF_CLASS[m.difficulty ?? 0]}`}>{STREET_DIFF[m.difficulty ?? 0].name}</span>}</h3>
      <div className="meta">{done ? "Hecha." : m.street ? null : m.intro}</div>
      {!done && <div className="meta num">
        {missionMins(m)} min · {energy} energía
        {req.length > 0 && <> · pide {req.map(([k, v], i) => <span key={k} style={{ color: s.stats[k] < v ? "#eba09e" : undefined }}>{i ? ", " : ""}{STAT_SHORT[k]} {v}</span>)}</>}
        {m.reward && <> · {money(m.reward.gold)}, {m.reward.xp} XP, +{m.reward.resp} respeto</>}
        {m.street && m.gang && <> · +{m.aff} afinidad con <span style={{ color: GANGS[m.gang].color }}>{GANGS[m.gang].name}</span></>}
      </div>}
      {!done && note && <div className="lock">{note}</div>}</div>
    <div className="act"><button className={can ? "primary" : ""} disabled={busy || !can} onClick={() => act({ type: "mstart", id: m.id })}>{done ? "Hecha" : "Salir"}</button></div>
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
  useEffect(() => { api.ranking().then(setRows).catch(() => setRows([])); }, [s.respect]);
  return <>
    <h2>Ranking de Malos Aires</h2>
    <p>Quién manda en Malos Aires, de las cuatro pandillas. Se ordena por respeto.</p>
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
