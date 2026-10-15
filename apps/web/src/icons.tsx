/* Íconos de equipo: las armas de fuego son pixel art (arlantr); cuchillo y escudo vienen de packs de íconos;
   el resto está dibujado acá, en estilo plano con borde oscuro. */
import type { ReactNode } from "react";
import { img } from "./art";

const S = { stroke: "#1b1820", strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const svg = (children: ReactNode) => <svg viewBox="0 0 64 64" aria-hidden="true">{children}</svg>;

const DRAWN: Record<string, ReactNode> = {
  llave: svg(<g {...S} transform="rotate(-45 32 32)">
    <rect x="28" y="24" width="8" height="34" rx="3" fill="#a9b2bc" />
    <path d="M21 6h22v17h-7v-9h-8v9h-7z" fill="#a9b2bc" />
  </g>),
  bate: svg(<g {...S}>
    <path d="M14 56l-6-6 33-35c5-5 13-3 15 1s1 9-4 13z" fill="#c9a36a" />
    <path d="M14 56l-6-6 6-6 6 6z" fill="#3b3440" />
  </g>),
  baston: svg(<g {...S} transform="rotate(-45 32 32)">
    <rect x="29" y="4" width="6" height="40" rx="3" fill="#4a4f58" />
    <rect x="27" y="42" width="10" height="18" rx="3" fill="#2a2d33" />
  </g>),
  tonfa: svg(<g {...S}>
    <rect x="8" y="26" width="48" height="9" rx="4" fill="#2e3138" />
    <rect x="16" y="35" width="7" height="16" rx="3" fill="#2e3138" />
  </g>),
  taser: svg(<g {...S}>
    <path d="M8 20h40l8 6v6H8z" fill="#f2c94c" />
    <path d="M14 32h12l-3 20H11z" fill="#2e3138" />
    <path d="M40 10l-6 8h6l-5 8" fill="none" stroke="#5b9be6" />
  </g>),
  manopla: svg(<g {...S}>
    <path d="M10 30h44v10c0 6-6 10-12 10H22c-6 0-12-4-12-10z" fill="#c8913a" />
    {[16, 26, 36, 46].map(x => <circle key={x} cx={x} cy="22" r="6.5" fill="#c8913a" />)}
    {[16, 26, 36, 46].map(x => <circle key={`h${x}`} cx={x} cy="22" r="2.5" fill="#1b1820" stroke="none" />)}
  </g>),
  campera: svg(<g {...S}>
    <path d="M22 8l10 8 10-8 14 8 4 30h-9l-1-14v26H14V32l-1 14H4l4-30z" fill="#5a3b2a" />
    <path d="M32 16v42" fill="none" />
  </g>),
  casco: svg(<g {...S}>
    <path d="M8 40c0-17 11-28 26-28s22 11 22 24v8H8z" fill="#c43b3b" />
    <path d="M30 30h26v10H30z" fill="#1f2a38" />
  </g>),
  chaleco: svg(<g {...S}>
    <path d="M20 8h8l4 6 4-6h8l8 10v36H12V18z" fill="#4a5568" />
    <rect x="20" y="30" width="24" height="8" rx="2" fill="#2d3440" />
  </g>),
  botiquin: svg(<g {...S}>
    <rect x="8" y="18" width="48" height="36" rx="5" fill="#f4f1ea" />
    <path d="M24 18v-6h16v6" fill="none" />
    <path d="M28 26h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#e0524f" />
  </g>)
};

/* cada ítem del juego -> su ícono */
const ITEM_ICON: Record<string, string> = {
  llave: "llave", bate: "bate", suplemento: "botiquin", baston: "baston", campera: "campera", casco: "casco", chaleco: "chaleco", botiquin: "botiquin",
  tonfa: "tonfa", reglam: "chaleco", taser: "taser", antibalas: "chaleco", pistola: "png:arma_pistola", tactico: "chaleco",
  antimotin: "png:arma_antimotin", escudo: "png:escudo",
  manopla: "manopla", gruesa: "campera", navaja: "png:navaja", placas: "campera", recortada: "png:arma_recortada",
  robado: "chaleco", fusil: "png:arma_fusil", negro: "chaleco",
  revolver: "png:arma_pistola", gorra: "casco", antidisturbios: "casco"
};

export function ItemIcon({ id }: { id: string }) {
  const k = ITEM_ICON[id] ?? "bolso";
  return <span className={`icon ${k.startsWith("png:arma") ? "pixel" : ""}`}>{k.startsWith("png:") ? <img src={img(`iconos/${k.slice(4)}`)} alt="" /> : DRAWN[k] ?? <img src={img("iconos/bolso")} alt="" />}</span>;
}
