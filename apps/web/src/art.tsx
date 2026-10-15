/* Arte del juego: fondos, retratos y siluetas procesados por tools/assets/build.py.
   Créditos en docs/CREDITOS.md y en el botón "Créditos" del juego. */
import type { Side, TabKey } from "@pop/shared";

const files = import.meta.glob("./assets/**/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export const img = (name: string) => files[`./assets/${name}.webp`] ?? "";

export const AVATARS = [1, 2, 3, 4];
export const avatarImg = (n = 1) => img(`retratos/avatar_${AVATARS.includes(n) ? n : 1}`);

/* número estable a partir de un nombre, para que un rival tenga siempre la misma silueta */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const silhouette = (name: string) => img(`siluetas/${String((hash(name) % 10) + 1).padStart(2, "0")}`);

/* personajes con retrato propio; el resto son siluetas */
const NAMED: Record<string, string> = {
  "Marga": "marga", "Comisaria Inés Ríos": "rios", "La Señora": "senora", "El Gallego": "gallego", "Don Tito": "tito"
};
export const portraitOf = (name: string) => NAMED[name] ? img(`retratos/${NAMED[name]}`) : silhouette(name);
export const hasPortrait = (name: string) => !!NAMED[name];

export function sceneFor(tab: TabKey, side: Side | null) {
  if (tab === "laburos") return img(`fondos/${side ?? "laburos"}`);
  const map: Partial<Record<TabKey, string>> = {
    gimnasio: "gimnasio", ring: "gimnasio", feria: "feria", guardia: "guardia", misiones: "misiones", calle: "calle", ranking: "ranking"
  };
  return img(`fondos/${map[tab] ?? "calle"}`);
}

/* retrato redondo; las siluetas van sobre el color del bando */
export function Portrait({ src, side, size = 64, silhouetteOf }: { src: string; side?: Side | null; size?: number; silhouetteOf?: boolean }) {
  return <span className={`portrait ${side ?? ""} ${silhouetteOf ? "shadow" : ""}`} style={{ width: size, height: size }}><img src={src} alt="" /></span>;
}
