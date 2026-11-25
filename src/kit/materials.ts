import * as THREE from "three";

/**
 * Shared look-and-feel for every item of the Reciprocity-theorem kit.
 * The kit is built at roughly 1.8x real size so ~5 cm terminals stay visible
 * and clickable on a 2.6 m lab table (a deliberate "display scale").
 */
export const KIT = {
  baseboard: 0xe9e4d8,
  bakelite: 0x1b1b1f,
  brass: 0xc9a227,
  brassDark: 0x8a6d1f,
  steel: 0x9aa2ab,
  caseGrey: 0x3a4048,
  caseDark: 0x23272c,
  yellow: 0xf2c12e,
  red: 0xd23b3b,
  black: 0x17171a,
  cream: 0xefe7d2,
  green: 0x2fb15a,
} as const;

const cache = new Map<string, THREE.MeshStandardMaterial>();

function standard(
  key: string,
  color: number,
  metalness: number,
  roughness: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const existing = cache.get(key);
  if (existing) return existing;
  const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  cache.set(key, mat);
  return mat;
}

export const matBrass = (): THREE.MeshStandardMaterial => standard("brass", KIT.brass, 0.9, 0.32);
export const matBakelite = (): THREE.MeshStandardMaterial =>
  standard("bakelite", KIT.bakelite, 0.05, 0.75);
export const matCeramic = (): THREE.MeshStandardMaterial =>
  standard("ceramic", KIT.cream, 0.0, 0.6);
export const matSteel = (): THREE.MeshStandardMaterial => standard("steel", KIT.steel, 0.85, 0.35);
export const matCase = (): THREE.MeshStandardMaterial =>
  standard("case", KIT.caseGrey, 0.5, 0.55);
export const matCaseDark = (): THREE.MeshStandardMaterial =>
  standard("caseDark", KIT.caseDark, 0.35, 0.6);
export const matYellow = (): THREE.MeshStandardMaterial =>
  standard("yellow", KIT.yellow, 0.05, 0.5);
export const matRed = (): THREE.MeshStandardMaterial => standard("red", KIT.red, 0.1, 0.5);
export const matGreen = (): THREE.MeshStandardMaterial =>
  standard("green", KIT.green, 0.1, 0.4, { emissive: KIT.green, emissiveIntensity: 0.25 });
export const matBlackPlastic = (): THREE.MeshStandardMaterial =>
  standard("blackPlastic", KIT.black, 0.05, 0.55);
export const matBoard = (): THREE.MeshStandardMaterial =>
  standard("baseboard", KIT.baseboard, 0.02, 0.7);

/** Draw text onto a canvas texture (used for every nameplate / readout). */
export function makeTextTexture(
  lines: string[],
  opts: { bg?: string; fg?: string; accent?: string; width?: number; height?: number } = {},
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = opts.width ?? 512;
  canvas.height = opts.height ?? 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  ctx.fillStyle = opts.bg ?? "#f7f4ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (opts.accent) {
    ctx.fillStyle = opts.accent;
    ctx.fillRect(0, 0, canvas.width, 12);
  }

  const top = lines.length === 1 ? 0.5 : 0.34;
  const step = lines.length === 1 ? 0 : 0.3;
  const maxWidth = canvas.width * 0.94;
  lines.forEach((line, i) => {
    const big = i === 0;
    const weight = big ? "bold " : "";
    let size = big ? 96 : 52;
    // Shrink the font until the line fits inside the plate.
    do {
      ctx.font = `${weight}${size}px "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(line).width <= maxWidth) break;
      size -= 2;
    } while (size > 14);
    ctx.fillStyle = big ? opts.fg ?? "#141418" : "#5b6068";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(line, canvas.width / 2, canvas.height * (top + i * step));
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A flat, always-readable nameplate (unlit, so labels never wash out). */
export function makeNameplate(
  width: number,
  height: number,
  lines: string[],
  opts: Parameters<typeof makeTextTexture>[1] = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(lines, opts), toneMapped: false }),
  );
  return mesh;
}
