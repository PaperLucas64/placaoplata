/* Arte del juego: fondos, retratos y siluetas procesados por tools/assets/build.py.
   Créditos en docs/CREDITOS.md y en el botón "Créditos" del juego. */
import { affShare, affTotal, GANG_KEYS, GANGS, type Gang, type PlayerState, type TabKey } from "@pop/shared";

const files = import.meta.glob("./assets/**/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export const img = (name: string) => files[`./assets/${name}.webp`] ?? "";

export const AVATARS = [1, 2, 3, 4];
export const avatarImg = (n = 1) => img(`retratos/avatar_${AVATARS.includes(n) ? n : 1}`);

/* número estable a partir de un nombre, para que un rival tenga siempre la misma silueta */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const silhouette = (name: string) => img(`siluetas/${String((hash(name) % 10) + 1).padStart(2, "0")}`);

/* personajes con retrato propio; el resto son siluetas */
const NAMED: Record<string, string> = {
  "Marga": "marga", "Don Tito": "tito", "Comisaria Inés Ríos": "rios", "El Gallego": "gallego",
  "La Señora": "senora", "El Gordo Bermejo": "bermejo", "El Tano Lucero": "lucero", "Rita \"Taxi\" Quiroga": "rita"
};
export const portraitOf = (name: string) => NAMED[name] ? img(`retratos/${NAMED[name]}`) : silhouette(name);
export const hasPortrait = (name: string) => !!NAMED[name];
export const bossImg = (g: Gang) => portraitOf(GANGS[g].boss);

export function sceneFor(tab: TabKey, gang: Gang | null) {
  const map: Partial<Record<TabKey, string>> = {
    laburos: gang ?? "laburos", gimnasio: "gimnasio", ring: "gimnasio", feria: "feria", guardia: "guardia",
    misiones: "misiones", calle: "calle", casa: "casa", ranking: "ranking", negocios: "bar", amigos: "bar"
  };
  return img(`fondos/${map[tab] ?? "calle"}`);
}

/* retrato redondo; las siluetas van sobre el color de su pandilla */
export function Portrait({ src, gang, size = 64, silhouetteOf }: { src: string; gang?: Gang | null; size?: number; silhouetteOf?: boolean }) {
  const c = gang ? GANGS[gang]?.color : undefined;
  const style = { width: size, height: size, ...(c ? { borderColor: c, background: `radial-gradient(circle at 50% 40%, ${c}cc, #0d0e10 78%)` } : {}) };
  return <span className={`portrait ${silhouetteOf && !c ? "shadow" : ""}`} style={style}><img src={src} alt="" /></span>;
}

/* Tu avatar con el anillo de pandillas: cada color es la parte de tu afinidad con esa pandilla */
export function GangRing({ s, size = 96 }: { s: PlayerState; size?: number }) {
  let from = 0;
  const parts = affTotal(s) ? GANG_KEYS.map(g => {
    const to = from + affShare(s, g) * 360;
    const seg = `${GANGS[g].color} ${from}deg ${to}deg`; from = to; return seg;
  }) : ["#3a3f46 0deg 360deg"];
  return (
    <span className="ring" style={{ width: size + 14, height: size + 14, background: `conic-gradient(${parts.join(",")})` }}
      title={GANG_KEYS.map(g => `${GANGS[g].name}: ${Math.round(affShare(s, g) * 100)}%`).join(" · ")}>
      <Portrait src={avatarImg(s.avatar)} size={size} />
    </span>
  );
}

export function GangBadge({ gang }: { gang?: Gang | null }) {
  if (!gang || !GANGS[gang]) return <span className="badge">Suelto</span>;
  return <span className="badge" style={{ borderColor: GANGS[gang].color, color: GANGS[gang].color }}>{GANGS[gang].name}</span>;
}

/* personajes del mapa (estilo RPG Maker, de «ゆうひな»): uno por retrato y uno propio por cada vecino que juega solo */
const SPRITE_OF_AVATAR: Record<number, number> = { 1: 23, 2: 144, 3: 50, 4: 47 };
const BOT_SPRITES: Record<string, number> = {
  "Tincho Ferreyra": 38, "La Colorada Paz": 170, "Pocho Benítez": 7, "Yésica Ramos": 58,
  "Nacho del Once": 13, "Juanca Godoy": 33, "Lali Torres": 32, "El Chino Acuña": 45
};
const spriteImg = (n: number) => img(`sprites/pj_${n}`);
export const playerSprite = (avatar?: number) => spriteImg(SPRITE_OF_AVATAR[avatar ?? 1] ?? 23);
export const travelerSprite = (t: { name: string; avatar: number; bot?: boolean }) =>
  t.bot && BOT_SPRITES[t.name] ? spriteImg(BOT_SPRITES[t.name]) : playerSprite(t.avatar);
