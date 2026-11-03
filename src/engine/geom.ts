import type { Contour, Motif, Pt } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function hypot(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function motifChirality(motif: Motif): number {
  const c = motif.contours[0];
  if (!c || c.pts.length < 3) return 0;
  return Math.sign(signedArea(c.pts)) || 1;
}

export function circlePoints(cx: number, cy: number, r: number, n = 28): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function arcPoints(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  n = 12,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Closed ribbon between two radii across an angle span. */
export function arcRibbon(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  n = 10,
): Pt[] {
  const outer = arcPoints(cx, cy, r1, a0, a1, n);
  const inner = arcPoints(cx, cy, r0, a1, a0, n);
  return outer.concat(inner);
}

export function rectPoints(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function polygon(sides: number, r = 0.5, rot = -Math.PI / 2): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export function starPoints(points: number, outer = 0.5, inner = 0.22): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export function rotatePt(p: Pt, rad: number, ox = 0, oy = 0): Pt {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const x = p.x - ox;
  const y = p.y - oy;
  return { x: ox + x * c - y * s, y: oy + x * s + y * c };
}

export function placeMotif(
  motif: Motif,
  x: number,
  y: number,
  rot: number,
  scale: number,
  flip = false,
): Contour[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const sx = flip ? -scale : scale;
  return motif.contours.map((ct) => ({
    closed: ct.closed,
    pts: ct.pts.map((p) => {
      const lx = p.x * sx;
      const ly = p.y * scale;
      return { x: x + (lx * c - ly * s), y: y + (lx * s + ly * c) };
    }),
  }));
}

/** Apply a linear map to local motif space, then translate so the origin lands on (x, y). */
export function placeLinear(
  motif: Motif,
  x: number,
  y: number,
  a: number,
  b: number,
  c: number,
  d: number,
  scale: number,
): Contour[] {
  return motif.contours.map((ct) => ({
    closed: ct.closed,
    pts: ct.pts.map((p) => ({
      x: x + (a * p.x + c * p.y) * scale,
      y: y + (b * p.x + d * p.y) * scale,
    })),
  }));
}

export function mapContours(contours: Contour[], fn: (p: Pt, contour: Contour) => Pt): Contour[] {
  return contours.map((ct) => ({
    closed: ct.closed,
    pts: ct.pts.map((p) => fn(p, ct)),
  }));
}

export function translateContours(contours: Contour[], dx: number, dy: number): Contour[] {
  return mapContours(contours, (p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function scaleContours(contours: Contour[], ox: number, oy: number, s: number): Contour[] {
  return mapContours(contours, (p) => ({
    x: ox + (p.x - ox) * s,
    y: oy + (p.y - oy) * s,
  }));
}

export function rotateContours(contours: Contour[], ox: number, oy: number, rad: number): Contour[] {
  return mapContours(contours, (p) => rotatePt(p, rad, ox, oy));
}

export function pathD(contours: Contour[]): string {
  let d = "";
  for (const ct of contours) {
    if (ct.pts.length === 0) continue;
    const p0 = ct.pts[0]!;
    d += `M${round(p0.x)} ${round(p0.y)}`;
    for (let i = 1; i < ct.pts.length; i++) {
      const p = ct.pts[i]!;
      d += `L${round(p.x)} ${round(p.y)}`;
    }
    if (ct.closed) d += "Z";
  }
  return d;
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function boundsOf(contours: Contour[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ct of contours) {
    for (const p of ct.pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

export function normalizeMotif(motif: Motif, size = 1): Motif {
  const b = boundsOf(motif.contours);
  const w = Math.max(1e-6, b.maxX - b.minX);
  const h = Math.max(1e-6, b.maxY - b.minY);
  const s = size / Math.max(w, h);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    evenodd: motif.evenodd,
    contours: motif.contours.map((ct) => ({
      closed: ct.closed,
      pts: ct.pts.map((p) => ({ x: (p.x - cx) * s, y: (p.y - cy) * s })),
    })),
  };
}

export function smoothFalloff(dist: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = clamp(1 - dist / radius, 0, 1);
  return t * t * (3 - 2 * t);
}

export function gaussian(x: number, width: number): number {
  if (width <= 1e-6) return 0;
  return Math.exp(-0.5 * (x / width) ** 2);
}
