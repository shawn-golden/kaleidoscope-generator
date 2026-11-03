import { mod } from "../geom";
import { bool, int, num } from "../params";
import { rng } from "../prng";
import { stampMotif } from "../stamp";
import type { Instance, Motif, ParamField, Params } from "../types";

export const kaleidoscopeFields: ParamField[] = [
  { key: "sectors", label: "Sectors", kind: "int", min: 3, max: 24, step: 1, default: 8 },
  { key: "reflect", label: "Reflection", kind: "boolean", default: true },
  { key: "rings", label: "Rings", kind: "int", min: 1, max: 14, step: 1, default: 5 },
  { key: "inner", label: "Inner radius", kind: "number", min: 0, max: 0.7, step: 0.01, default: 0.08 },
  { key: "copies", label: "Copies in wedge", kind: "int", min: 1, max: 6, step: 1, default: 2 },
  { key: "offset", label: "Ring offset", kind: "number", min: -40, max: 40, step: 0.5, default: 0, hint: "Degrees of twist per ring" },
  { key: "break", label: "Symmetry break", kind: "number", min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: "scale", label: "Motif scale", kind: "number", min: 0.15, max: 1.6, step: 0.01, default: 0.72 },
  { key: "spin", label: "Motif spin", kind: "number", min: -180, max: 180, step: 1, default: 0 },
];

/** Angles produced by cyclic or dihedral expansion of one wedge sample. */
export function expandAngles(theta: number, sectors: number, reflect: boolean): number[] {
  const n = Math.max(1, Math.round(sectors));
  if (!reflect) {
    const step = (Math.PI * 2) / n;
    return Array.from({ length: n }, (_, k) => theta + k * step);
  }
  const wedge = Math.PI / n;
  let a = mod(theta, wedge * 2);
  if (a > wedge) a = wedge * 2 - a;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    out.push(a + k * 2 * wedge);
    out.push(-a + k * 2 * wedge);
  }
  return out;
}

export function buildKaleidoscope(
  params: Params,
  motif: Motif,
  seed: string,
  width: number,
  height: number,
  idPrefix = "k",
): Instance[] {
  const sectors = int(params, "sectors", 8);
  const reflect = bool(params, "reflect", true);
  const rings = int(params, "rings", 5);
  const innerRatio = num(params, "inner", 0.08);
  const copies = int(params, "copies", 2);
  const offset = num(params, "offset", 0);
  const brk = num(params, "break", 0.08);
  const scaleK = num(params, "scale", 0.72);
  const spin = (num(params, "spin", 0) * Math.PI) / 180;
  const rand = rng(seed, "kaleidoscope");
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.46;
  const inner = maxR * innerRatio;
  const spacing = (maxR - inner) / Math.max(1, rings);
  const wedge = (reflect ? Math.PI : Math.PI * 2) / sectors;
  const out: Instance[] = [];

  for (let ring = 0; ring < rings; ring++) {
    const radius = inner + (ring + 0.5) * spacing;
    for (let copy = 0; copy < copies; copy++) {
      let theta = ((copy + 0.5) / copies) * wedge * 0.86;
      theta += ((offset * Math.PI) / 180) * ring;
      theta += (rand() - 0.5) * brk * wedge;
      const radialJitter = (rand() - 0.5) * brk * spacing * 0.45;
      const rad = Math.max(4, radius + radialJitter);
      const localScale = Math.min(spacing * scaleK, rad * 0.62) * (1 + (rand() - 0.5) * brk * 0.35);
      const localSpin = spin + (rand() - 0.5) * brk * 0.8;
      const angles = expandAngles(theta, sectors, reflect);
      angles.forEach((angle, index) => {
        const mirrored = reflect && index % 2 === 1;
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        out.push(
          stampMotif(`${idPrefix}-${ring}-${copy}-${index}`, motif, x, y, angle + localSpin, localScale, width, height, {
            flip: mirrored,
            colorIndex: ring + copy,
            ring,
            checker: (ring + index) % 2,
            angle,
          }),
        );
      });
    }
  }
  return out;
}
