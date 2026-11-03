/** Wallpaper and frieze group elements. Square groups are closed under composition modulo the unit cell. */

export type Aff = { a: number; b: number; c: number; d: number; e: number; f: number };

export const ID: Aff = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function compose(m: Aff, n: Aff): Aff {
  return {
    a: m.a * n.a + m.c * n.b,
    c: m.a * n.c + m.c * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    b: m.b * n.a + m.d * n.b,
    d: m.b * n.c + m.d * n.d,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function applyAff(m: Aff, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

export function det(m: Aff): number {
  return m.a * m.d - m.b * m.c;
}

function mod1(v: number): number {
  return ((v % 1) + 1) % 1;
}

export function modCell(m: Aff): Aff {
  return { ...m, e: mod1(m.e), f: mod1(m.f) };
}

/** 90° around the center of the unit cell. */
const ROT90: Aff = { a: 0, b: -1, c: 1, d: 0, e: 0, f: 1 };
/** 90° around the origin, the 4-fold center used by p4g. */
const ROT90_ORIGIN: Aff = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
const ROT180: Aff = { a: -1, b: 0, c: 0, d: -1, e: 1, f: 1 };
const REFLECT_V: Aff = { a: -1, b: 0, c: 0, d: 1, e: 1, f: 0 };
const REFLECT_H: Aff = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 1 };
/**
 * p4g glide: reflect vertically and shift half a cell.
 * Together with origin 4-fold rotation this closes to the 8-element group
 * with diagonal mirrors and axis glides (orbifold 4*2).
 */
const GLIDE_P4G: Aff = { a: 1, b: 0, c: 0, d: -1, e: 0.5, f: 0.5 };

function close(generators: Aff[]): Aff[] {
  const key = (m: Aff) =>
    [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => Math.round(v * 1e6) / 1e6).join(",");
  const seen = new Map<string, Aff>();
  const queue: Aff[] = [ID];
  seen.set(key(ID), ID);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const g of generators) {
      const next = modCell(compose(g, cur));
      const k = key(next);
      if (!seen.has(k)) {
        seen.set(k, next);
        queue.push(next);
        if (seen.size > 64) break;
      }
    }
  }
  return [...seen.values()];
}

const SQUARE_GROUPS: Record<string, Aff[]> = {
  p1: close([]),
  p2: close([ROT180]),
  pm: close([REFLECT_V]),
  pmm: close([REFLECT_V, REFLECT_H]),
  p4: close([ROT90]),
  p4m: close([ROT90, REFLECT_V]),
  p4g: close([ROT90_ORIGIN, GLIDE_P4G]),
};

export function squareGroup(group: string): Aff[] {
  return SQUARE_GROUPS[group] ?? SQUARE_GROUPS.p1!;
}

export function hexOrbit(x: number, y: number, mirrors: boolean): { x: number; y: number; rot: number; flip: boolean }[] {
  const out: { x: number; y: number; rot: number; flip: boolean }[] = [];
  const flips = mirrors ? [false, true] : [false];
  for (const flip of flips) {
    const sx = flip ? -x : x;
    const sy = y;
    for (let k = 0; k < 6; k++) {
      const rot = (k * Math.PI) / 3;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      out.push({ x: sx * c - sy * s, y: sx * s + sy * c, rot, flip });
    }
  }
  return out;
}

export type FriezeOp = { x: number; y: number; rot: number; flip: boolean };

/** Ops inside one period. x is a fraction of the period, y a fraction of the band height, both centered. */
export function friezeOps(group: string): FriezeOp[] {
  const id: FriezeOp = { x: 0, y: 0, rot: 0, flip: false };
  switch (group) {
    case "p1m1":
      return [id, { x: 0, y: 0, rot: 0, flip: true }];
    case "p11m":
      return [id, { x: 0, y: 0, rot: Math.PI, flip: true }];
    case "p11g":
      return [id, { x: 0.5, y: 0, rot: 0, flip: true }];
    case "p211":
      return [id, { x: 0.5, y: 0, rot: Math.PI, flip: false }];
    case "p2mm":
      return [
        id,
        { x: 0, y: 0, rot: 0, flip: true },
        { x: 0.5, y: 0, rot: Math.PI, flip: false },
        { x: 0.5, y: 0, rot: Math.PI, flip: true },
      ];
    case "p2mg":
      return [
        id,
        { x: 0.5, y: 0, rot: Math.PI, flip: false },
        { x: 0.5, y: 0, rot: 0, flip: true },
        { x: 0, y: 0, rot: Math.PI, flip: true },
      ];
    default:
      return [id];
  }
}

export const WALLPAPER_GROUPS = ["p1", "p2", "pm", "pmm", "p4", "p4m", "p4g", "p6", "p6m"] as const;
export const FRIEZE_GROUPS = ["p111", "p1m1", "p11m", "p11g", "p211", "p2mm", "p2mg"] as const;
