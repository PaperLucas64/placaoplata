/* Subir de nivel, de rango o entrar a una pandilla: su tarjeta, con lo que se destrabó y lo que viene.
   Y al volver al juego, «Mientras no estabas»: lo mejor que pasó, lo malo con su causa y lo que está por cerrarse. */
import { EVENTS, findMission, GANGS, HOME, missionsAtRank, nextUnlock, rankOf, RANK_NAMES, respectToNext, STAT_NAMES, unlocksAt, type Gang, type LogEntry, type PlayerState } from "@pop/shared";
import type { ReactNode } from "react";
import { bossImg, Portrait } from "./art";

export type Moment = { kind: "lvl"; lvl: number } | { kind: "rank"; rank: number; gang: Gang | null } | { kind: "gang"; gang: Gang };

const KIND_TXT: Record<string, string> = { laburo: "Laburo", golpe: "Golpe", equipo: "Equipo", casa: "Casa", negocio: "Negocio", "vehículo": "Vehículo" };

export function Celebration({ m, s, onClose }: { m: Moment; s: PlayerState; onClose: () => void }) {
  let title = "", sub = "", body: ReactNode = null;
  if (m.kind === "lvl") {
    const now = unlocksAt(m.lvl), next = nextUnlock(m.lvl);
    title = `Nivel ${m.lvl}`; sub = "Vida al máximo.";
    body = <>
      {now.length > 0 && <><h3>Ahora podés</h3><ul>{now.map(u => <li key={u.name}><span className="tag">{KIND_TXT[u.kind]}</span> {u.name}</li>)}</ul></>}
      {next && <><h3>En el nivel {next.lvl}</h3><ul className="next">{next.items.map(u => <li key={u.name}><span className="tag">{KIND_TXT[u.kind]}</span> {u.name}</li>)}</ul></>}
    </>;
  } else if (m.kind === "rank") {
    const opened = m.gang ? missionsAtRank(m.gang, m.rank) : [], left = respectToNext(s.respect);
    title = RANK_NAMES[m.rank] ?? ""; sub = `Subiste de rango${m.gang ? ` en ${GANGS[m.gang].name}` : ""}.`;
    body = <>
      {opened.length > 0 && <><h3>Se abrió</h3><ul>{opened.map(x => <li key={x.id}><span className="tag">Historia</span> {x.title}</li>)}</ul></>}
      {left !== null && RANK_NAMES[m.rank + 1] && <p className="tag num">Te faltan {left} de respeto para {RANK_NAMES[m.rank + 1]}.</p>}
    </>;
  } else {
    const g = GANGS[m.gang];
    title = g.name; sub = `Ahora sos de ${g.name}. ${g.perk}.`;
    body = <div className="boss-say"><Portrait src={bossImg(m.gang)} gang={m.gang} size={72} /><p>«{g.say}»<br /><span className="tag">{g.boss}</span></p></div>;
  }
  return <div className="moment" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={m.kind !== "lvl" && "gang" in m && m.gang ? { borderColor: GANGS[m.gang].color } : undefined}>
      <span className="tag">{sub}</span>
      <h2>{title}</h2>
      {body}
      <div><button className="primary" onClick={onClose} autoFocus>Seguir</button></div>
    </div>
  </div>;
}

/* ---------- Mientras no estabas ---------- */
const KEY = (name: string) => `malandro.visto.${name}`;
export const AWAY_MIN_MS = 15 * 60_000; // menos que esto no cuenta como «volver»
export const lastSeen = (name: string) => { try { return Number(localStorage.getItem(KEY(name))) || 0; } catch { return 0; } };
export const markSeen = (name: string, t: number) => { try { localStorage.setItem(KEY(name), String(t)); } catch { /* sin almacenamiento */ } };

const hm = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)), h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };
const ago = (ms: number) => { const h = Math.round(ms / 3_600_000); return h >= 48 ? `${Math.round(h / 24)} días` : h >= 1 ? `${h} h` : `${Math.max(1, Math.round(ms / 60_000))} min`; };

/* lo que pasó desde la última vez: primero lo mejor, después lo malo y al final lo que viene */
export function awayNews(s: PlayerState, since: number, now: number) {
  const fresh = s.log.filter((l: LogEntry) => l.t > since);
  const best = fresh.filter(l => l.cls === "gold" || l.cls === "good").slice(0, 4);
  const bad = fresh.filter(l => l.cls === "bad").slice(0, 3);
  const soon: string[] = [];
  const b = s.busy;
  if (b && b.until > now) soon.push(b.kind === "mision" ? `«${findMission(s, b.id)?.title ?? "La misión"}» termina en ${hm(b.until - now)}`
    : b.kind === "gym" ? `Terminás de entrenar ${STAT_NAMES[b.stat].toLowerCase()} en ${hm(b.until - now)}`
    : b.kind === "vuelta" ? `Llegás a casa en ${hm(b.until - now)}` : `Terminás en ${hm(b.until - now)}`);
  const o = s.home?.obra;
  if (o && o.until > now) soon.push(`La obra de ${HOME[o.part].levels[s.home[o.part] + 1]?.name.toLowerCase() ?? "la casa"} termina en ${hm(o.until - now)}`);
  const left = respectToNext(s.respect);
  if (left !== null && left <= 120 && RANK_NAMES[rankOf(s) + 1]) soon.push(`Te faltan ${left} de respeto para ${RANK_NAMES[rankOf(s) + 1]}`);
  /* el próximo evento del calendario, si falta poco */
  const d = new Date(now - 3 * 3_600_000);
  for (const e of EVENTS) {
    const start = Date.UTC(d.getUTCFullYear(), e.from[0] - 1, e.from[1]) + 3 * 3_600_000;
    const days = Math.ceil((start - now) / 86_400_000);
    if (days > 0 && days <= 5) soon.push(`${days === 1 ? "Mañana" : `En ${days} días`} empieza la ${e.name}`);
  }
  return { best, bad, soon, count: fresh.length };
}

export function Away({ s, since, now, onClose }: { s: PlayerState; since: number; now: number; onClose: () => void }) {
  const n = awayNews(s, since, now);
  return <div className="moment away" role="dialog" aria-modal="true" aria-label="Mientras no estabas" onClick={onClose}>
    <div onClick={e => e.stopPropagation()}>
      <span className="tag">Hace {ago(now - since)} que no pasabas</span>
      <h2>Mientras no estabas</h2>
      {n.best.length > 0 && <><h3>Lo bueno</h3><ul>{n.best.map((l, i) => <li key={i} className="good">{l.msg}</li>)}</ul></>}
      {n.bad.length > 0 && <><h3>Lo malo</h3><ul>{n.bad.map((l, i) => <li key={i} className="bad">{l.msg}</li>)}</ul></>}
      {n.best.length + n.bad.length === 0 && <p className="tag">La ciudad estuvo tranquila.</p>}
      {n.soon.length > 0 && <><h3>Lo que viene</h3><ul className="next">{n.soon.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
      {n.count > n.best.length + n.bad.length && <p className="tag">El resto está en la Crónica.</p>}
      <div><button className="primary" onClick={onClose} autoFocus>A la calle</button></div>
    </div>
  </div>;
}
