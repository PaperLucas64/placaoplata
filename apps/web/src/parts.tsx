import { useState, type ReactNode } from "react";
import {
  clamp, energyMax, findMission, HOME, ENERGY_EVERY, gangOf, maxHp, money, RANK_NAMES, rankOf, SHOP, STAT_NAMES, xpNeed,
  type FightView, type PlayerState, type StatKey, eff, gearBonus, SLOTS, SLOT_NAMES, GANGS, GANG_KEYS, MISSIONS, EPISODE, STORY_NAME, ACT_NAMES,
  type Gang } from "@pop/shared";
import { avatarImg, GangBadge, GangRing, Portrait, portraitOf } from "./art";
import { ItemIcon } from "./icons";

export function Bar({ cls, label, v, max, note }: { cls: string; label: string; v: number; max: number; note?: string }) {
  return (
    <div className={`bar ${cls}`}>
      <div className="row"><span>{label}{note && <> <span className="tag">{note}</span></>}</span><span className="num">{v} / {max}</span></div>
      <div className="track"><div className="fill" style={{ width: `${clamp(v / max * 100, 0, 100)}%` }} /></div>
    </div>
  );
}

/* La barra de arriba del mapa: quién sos, cómo estás y qué estás haciendo. La ficha completa, con un botón. */
export function Hud({ s, now, onSheet, onQuick, onCancel, disabled }: { s: PlayerState; now: number; onSheet: () => void; onQuick: () => void; onCancel: () => void; disabled: boolean }) {
  const mh = maxHp(s), em = energyMax(s), g = gangOf(s);
  const mini = (cls: string, label: string, v: number, max: number) => (
    <div className={`mini ${cls}`} title={`${label}: ${v} / ${max}`}>
      <span className="mini-label">{label}</span>
      <div className="track"><div className="fill" style={{ width: `${clamp(v / max * 100, 0, 100)}%` }} /></div>
      <span className="num mini-v">{v}/{max}</span>
    </div>);
  return (
    <div className="hud">
      <button className="hud-who" onClick={onSheet} title="Ver tu ficha">
        <GangRing s={s} size={46} />
        <span><b>{s.name}</b><span className="tag">Nivel {s.lvl}{s.tutDone ? ` · ${g ? GANGS[g].name : "Suelto"}` : ""}</span></span>
      </button>
      <div className="hud-bars">
        {mini("hp", "Vida", Math.round(s.hp), mh)}
        {mini("en", "Energía", s.energy, em)}
        {mini("xp", "XP", s.xp, xpNeed(s))}
        {s.tutDone && mini("heat", "Búsqueda", s.heat, 100)}
      </div>
      <span className="hud-gold num">{money(s.gold)}</span>
      <div className="hud-busy"><BusyBar s={s} now={now} onCancel={onCancel} disabled={disabled} /></div>
      <button className="hud-sheet" onClick={onSheet}>Ficha</button>
      <button className="hud-sheet primary" disabled={disabled} onClick={onQuick} title="Una misión o un trabajo al azar, de los que podés hacer ahora">Actividad rápida</button>
    </div>
  );
}

export function Sheet({ s, now, onCancel, disabled }: { s: PlayerState; now: number; onCancel: () => void; disabled: boolean }) {
  const mh = maxHp(s);
  const em = energyMax(s), g = gangOf(s);
  const nextE = s.energy < em ? Math.max(0, Math.ceil((ENERGY_EVERY - (now - s.tEnergy)) / 1000)) : 0;

  return (
    <aside className="sheet">
      <div className="who-row">
      <GangRing s={s} size={84} />
      <div className="who">
        <h2>{s.name}</h2>
        {s.tutDone ? <GangBadge gang={g} /> : <span className="badge">Recién llegado</span>}
        <span className="tag">Nivel {s.lvl}</span>
      </div>
      </div>
      <BusyBar s={s} now={now} onCancel={onCancel} disabled={disabled} />
      <Bar cls="hp" label="Vida" v={Math.round(s.hp)} max={mh} />
      <Bar cls="en" label="Energía" v={s.energy} max={em} note={nextE ? `+1 en ${nextE}s` : ""} />
      <Bar cls="xp" label="Experiencia" v={s.xp} max={xpNeed(s)} />
      {s.tutDone && <Bar cls="heat" label="Nivel de búsqueda" v={s.heat} max={100} note={s.heat >= 60 ? "cuidado" : ""} />}
      {s.tutDone && <div className="stat"><span>{RANK_NAMES[rankOf(s)]}</span><span className="num">{s.respect} de respeto</span></div>}
      <div className="money"><span>Plata encima</span><span className="num">{money(s.gold)}</span></div>
      {s.home.safe > 0 && <div className="stat"><span>En la caja fuerte</span><span className="num">{money(s.home.safe)}</span></div>}
      {s.tabs.includes("gimnasio") && (
        <div className="stats">{(Object.keys(STAT_NAMES) as StatKey[]).map(k =>
          <div className="stat" key={k}><span>{STAT_NAMES[k]}</span><span className="num">{eff(s, k)}{gearBonus(s, k) > 0 && <span className="bonus"> (+{gearBonus(s, k)})</span>}</span></div>)}
        </div>
      )}
      {s.tabs.includes("feria") && (
        <div className="gear">
          <div className="gear-row">{SLOTS.map(k => s.gear[k]
            ? <span key={k} title={`${SLOT_NAMES[k]}: ${SHOP.find(i => i.id === s.gear[k])?.name}`}><ItemIcon id={s.gear[k]!} /></span>
            : <span key={k} className="icon empty" title={`${SLOT_NAMES[k]}: vacío`} />)}</div>
          {s.potions > 0 && <span>Botiquines: {s.potions}</span>}
        </div>
      )}
    </aside>
  );
}

export function Fight({ f, s }: { f: FightView; s: PlayerState }) {
  return (
    <section className={`fight ${f.won ? "" : "shake"}`} aria-live="polite">
      <div className="vs">
        <div className="side"><Portrait src={avatarImg(s.avatar)} gang={gangOf(s)} size={72} /><h3>{f.p.name}</h3><Bar cls="hp" label="Vida" v={f.p.hp} max={f.p.max} /></div>
        <div className="mid">VS</div>
        <div className="side"><Portrait src={portraitOf(f.e.name)} silhouetteOf size={72} /><h3>{f.e.name}</h3><Bar cls="hp" label="Vida" v={f.e.hp} max={f.e.max} /></div>
      </div>
      <div className="rounds">{f.rounds.map((r, i) => <div key={i} className={r.who}>{r.txt}</div>)}</div>
      <div className={`verdict ${f.won ? "win" : "lose"}`}>{f.won ? "Ganaste" : "Perdiste"}</div>
    </section>
  );
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function Chronicle({ s, onOut }: { s: PlayerState; onOut: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [credits, setCredits] = useState(false);
  const [view, setView] = useState<"diario" | "registro">("diario");
  return (
    <section className="log">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === "diario"} className={view === "diario" ? "on" : ""} onClick={() => setView("diario")}>Diario</button>
        <button role="tab" aria-selected={view === "registro"} className={view === "registro" ? "on" : ""} onClick={() => setView("registro")}>Lo último</button>
      </div>
      {view === "diario" ? <Diary s={s} /> : <>
      <div className="foot"><h3>Crónica</h3>
        <div className="confirm">{confirm
          ? <>¿Salir de tu cuenta? <button className="primary" onClick={onOut}>Sí, salir</button><button onClick={() => setConfirm(false)}>Cancelar</button></>
          : <><button className="link" onClick={() => setCredits(true)}>Créditos</button><button className="link" onClick={() => setConfirm(true)}>Salir</button></>}
        </div>
      </div>
      <ol>{s.log.map((l, i) => <li key={i}><time>{hhmm(l.t)}</time><span className={l.cls}>{l.msg}</span></li>)}</ol></>}
      {credits && <Credits onClose={() => setCredits(false)} />}
    </section>
  );
}

/* El diario: el episodio dividido en capítulos (uno por jefe) y cada capítulo en sus misiones.
   Cada misión hecha destraba su bloque: la fecha real, cómo te fue, la historia y qué pasaba en la ciudad. */
const fecha = (t: number) => new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) + ", " + hhmm(t);
function Diary({ s }: { s: PlayerState }) {
  const all = GANG_KEYS.flatMap(g => MISSIONS[g]), done = all.filter(m => s.diary?.[m.id]).length;
  const mine = gangOf(s);
  const order = [...GANG_KEYS].sort((a, b) => (b === mine ? 1 : 0) - (a === mine ? 1 : 0)
    || MISSIONS[b].filter(m => s.diary?.[m.id]).length - MISSIONS[a].filter(m => s.diary?.[m.id]).length);
  const [open, setOpen] = useState<Gang | null>(order[0]);
  return <div className="diary">
    <header><span className="tag">Temporada {EPISODE.season} · {EPISODE.arc}</span>
      <h3>Episodio {EPISODE.num} — {EPISODE.name}</h3>
      <span className="num tag">{done} de {all.length} páginas</span></header>
    {order.map(g => {
      const list = MISSIONS[g], got = list.filter(m => s.diary?.[m.id]).length;
      return <details key={g} open={open === g} onToggle={e => { if ((e.target as HTMLDetailsElement).open) setOpen(g); }}>
        <summary><b style={{ color: GANGS[g].color }}>{STORY_NAME[g]}</b> <span className="tag">{GANGS[g].boss} · {got} de {list.length}</span></summary>
        {list.map((m, i) => {
          const d = s.diary?.[m.id];
          const act = i % 5 === 0 ? <h4 key={`a${i}`} className="act">Acto {["I", "II", "III"][i / 5]} · {ACT_NAMES[i / 5]}</h4> : null;
          if (!d) return <div key={m.id}>{act}<div className="page locked"><span className="num">{m.story}</span> {i === 0 || s.diary?.[list[i - 1].id] ? m.title : "· · ·"}
            <span className="tag">{m.final ? "Final del capítulo · solo con tu pandilla" : "Sin escribir"}</span></div></div>;
          return <div key={m.id}>{act}<article className="page">
            <h5><span className="num">{m.story}</span> {m.title}</h5>
            <div className="tag">{fecha(d.t)} · {m.place} · {d.got} de {d.of} etapas salieron bien</div>
            <p>{m.lore}</p>
            {d.city?.length ? <div className="city-news"><span className="tag">Mientras tanto, en Maires:</span>{d.city.map((c, k) => <span key={k}>{c}</span>)}</div> : null}
          </article></div>;
        })}
      </details>;
    })}
  </div>;
}

/* Créditos del arte (algunas licencias lo piden; las demás lo agradecen). Ver docs/CREDITOS.md */
export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className="credits" role="dialog" aria-modal="true" aria-label="Créditos" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>
        <h2>Créditos</h2>
        <p>Malandro es un juego de Mauspi Lab.</p>
        <ul>
          <li><b>Fondos:</b> Noraneko Games (@NoranekoGames), packs de fondos para novela visual. Modificados (recorte y filtro nocturno).</li>
          <li><b>Retratos y siluetas:</b> わたおきば / Wataokiba (わたおび), personajes de cuerpo entero. Recortados.</li>
          <li><b>Armas de fuego:</b> arlantr, Free Guns Pixel Art (arlantr.itch.io).</li>
          <li><b>Íconos:</b> Prinbles, Yet Another Icons (prinbles.itch.io), y Robert Brooks, gamedeveloperstudio.com.</li>
          <li><b>Resto de íconos, código y diseño:</b> Mauspi Lab.</li>
        </ul>
        <div><button className="primary" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

/* 4:52 o, si pasa la hora, 5:04:52 (horas:minutos:segundos) */
const mmss = (ms: number) => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s2 = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s2}` : `${m}:${s2}`; };

/* Lo que estás haciendo en tiempo real (entrenar, guardia) y la obra de la casa: cuenta regresiva con su línea de tiempo */
function Countdown({ label, since, until, now, note, action }: { label: string; since: number; until: number; now: number; note?: string; action?: ReactNode }) {
  const total = Math.max(1, until - since), left = Math.max(0, until - now);
  return (
    <div className="busy" aria-live="polite">
      <div className="row"><b>{label}</b><span className="num">{mmss(left)}</span></div>
      <div className="track"><div className="fill" style={{ width: `${clamp((1 - left / total) * 100, 0, 100)}%` }} /></div>
      {(note || action) && <div className="row"><span className="tag">{note}</span>{action}</div>}
    </div>
  );
}

export function BusyBar({ s, now, onCancel, disabled }: { s: PlayerState; now: number; onCancel: () => void; disabled: boolean }) {
  const b = s.busy, o = s.home?.obra;
  if (!b && !o) return null;
  return <>
    {b && <Countdown now={now} since={b.since} until={b.until}
      label={b.kind === "gym" ? `Entrenando ${STAT_NAMES[b.stat].toLowerCase()}` : b.kind === "mision" ? `Misión: ${findMission(s, b.id)?.title ?? ""}`
        : b.kind === "caza" ? `Buscando a ${b.targetName}` : b.kind === "vuelta" ? (b.safe ? "En ambulancia a casa" : "Volviendo a casa")
        : b.kind === "salida" ? `${b.what === "golpe" ? "Golpe" : "Encargo"} en ${b.place}`
        : b.clinic ? "En la clínica" : "En la guardia"}
      note={b.kind === "gym" ? "Si cortás, perdés la plata y el punto." : b.kind === "mision" ? `Etapa ${Math.min(b.done + 1, findMission(s, b.id)?.steps.length ?? 1)} · la crónica te cuenta.`
        : b.kind === "caza" ? `Lo cruzás cerca de ${b.place}. Lo ves en el mapa.` : b.kind === "vuelta" ? (b.safe ? "Nadie te puede tocar." : "Andás por la calle: podés arrancar otra cosa desde acá.")
        : b.kind === "salida" ? "Cuando lo hagas, la crónica te cuenta cómo salió."
        : "Mientras te curan, nadie te puede tocar."}
      action={b.kind === "vuelta" ? undefined : <button className="link" disabled={disabled} onClick={onCancel}>Cancelar</button>} />}
    {o && <Countdown now={now} since={o.since} until={o.until} label={`Obra: ${HOME[o.part].levels[s.home[o.part] + 1]?.name.toLowerCase()}`} />}
  </>;
}
