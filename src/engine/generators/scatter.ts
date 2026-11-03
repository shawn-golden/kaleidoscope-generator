import { clamp, rectPoints } from "../geom";
import { bool, int, num, str } from "../params";
import { chance, irange, rng, type Rng } from "../prng";
import { cap, stampMotif } from "../stamp";
import { makeInstance } from "../stamp";
import type { Instance, Motif, ParamField, Params, Pt, ShapeId } from "../types";
import { shapeMotif } from "../shapes";

export const scatterFields: ParamField[] = [
  {
    key: "structure",
    label: "Structure",
    kind: "select",
    default: "grid",
    options: [
      { value: "grid", label: "Grid" },
      { value: "jitter", label: "Jittered grid" },
      { value: "poisson", label: "Poisson" },
      { value: "clusters", label: "Clusters" },
      { value: "rosette", label: "Rosette" },
      { value: "rings", label: "Concentric rings" },
      { value: "bands", label: "Mirrored bands" },
    ],
  },
  { key: "cols", label: "Columns", kind: "int", min: 2, max: 24, step: 1, default: 10 },
  { key: "rows", label: "Rows", kind: "int", min: 2, max: 24, step: 1, default: 10 },
  { key: "density", label: "Density", kind: "number", min: 0.05, max: 1, step: 0.01, default: 0.8 },
  { key: "jitter", label: "Jitter", kind: "number", min: 0, max: 0.8, step: 0.01, default: 0.35 },
  { key: "spacing", label: "Spacing", kind: "number", min: 24, max: 220, step: 1, default: 72 },
  { key: "clusters", label: "Cluster size", kind: "int", min: 3, max: 24, step: 1, default: 10 },
  { key: "scale", label: "Scale", kind: "number", min: 0.2, max: 2.4, step: 0.01, default: 0.7 },
  { key: "variety", label: "Shape variety", kind: "int", min: 1, max: 8, step: 1, default: 4 },
  {
    key: "symmetry",
    label: "Symmetry",
    kind: "select",
    default: "none",
    options: [
      { value: "none", label: "None" },
      { value: "bilateral", label: "Bilateral" },
      { value: "rot4", label: "Four-fold" },
    ],
  },
  { key: "links", label: "Arc links", kind: "boolean", default: false },
  { key: "hierarchy", label: "Hierarchy", kind: "boolean", default: true },
];

const VARIETY: ShapeId[] = ["circle", "square", "triangle", "diamond", "cross", "star", "asterisk", "chevron", "ring", "quarter"];

export function varietyMotif(primary: Motif, index: number, svg: boolean): Motif {
  if (index <= 0 || svg) return primary;
  return shapeMotif(VARIETY[(index - 1) % VARIETY.length]!);
}

export function poissonDisk(rand: Rng, width: number, height: number, minDist: number, limit = 700): Pt[] {
  const cell = minDist / Math.SQRT2;
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const grid: (Pt | null)[] = Array(cols * rows).fill(null);
  const points: Pt[] = [];
  const active: Pt[] = [];
  const indexOf = (p: Pt) => Math.floor(p.x / cell) + Math.floor(p.y / cell) * cols;
  const ok = (p: Pt) => {
    const gx = Math.floor(p.x / cell);
    const gy = Math.floor(p.y / cell);
    for (let y = gy - 2; y <= gy + 2; y++) {
      for (let x = gx - 2; x <= gx + 2; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const q = grid[x + y * cols];
        if (q && Math.hypot(q.x - p.x, q.y - p.y) < minDist) return false;
      }
    }
    return true;
  };
  const first = { x: rand() * width, y: rand() * height };
  points.push(first);
  active.push(first);
  grid[indexOf(first)] = first;
  while (active.length && points.length < limit) {
    const ai = Math.floor(rand() * active.length);
    const p = active[ai]!;
    let found = false;
    for (let k = 0; k < 18; k++) {
      const ang = rand() * Math.PI * 2;
      const rad = minDist * (1 + rand());
      const q = { x: p.x + Math.cos(ang) * rad, y: p.y + Math.sin(ang) * rad };
      if (q.x < 8 || q.y < 8 || q.x > width - 8 || q.y > height - 8) continue;
      if (!ok(q)) continue;
      points.push(q);
      active.push(q);
      grid[indexOf(q)] = q;
      found = true;
      break;
    }
    if (!found) active.splice(ai, 1);
  }
  return points;
}

function symmetricCopies(p: Pt, mode: string, width: number, height: number): Pt[] {
  const cx = width / 2;
  const cy = height / 2;
  if (mode === "bilateral") return [p, { x: width - p.x, y: p.y }];
  if (mode === "rot4") {
    const x = p.x - cx;
    const y = p.y - cy;
    const out: Pt[] = [];
    let px = x;
    let py = y;
    for (let k = 0; k < 4; k++) {
      out.push({ x: cx + px, y: cy + py });
      const nx = -py;
      const ny = px;
      px = nx;
      py = ny;
    }
    return out;
  }
  return [p];
}

export function buildScatter(
  params: Params,
  primary: Motif,
  seed: string,
  width: number,
  height: number,
  svgSource: boolean,
  idPrefix = "s",
): Instance[] {
  const structure = str(params, "structure", "grid");
  const cols = int(params, "cols", 10);
  const rows = int(params, "rows", 10);
  const density = num(params, "density", 0.8);
  const jitter = num(params, "jitter", 0.35);
  const spacing = num(params, "spacing", 72);
  const clusterSize = int(params, "clusters", 10);
  const scaleK = num(params, "scale", 0.7);
  const variety = int(params, "variety", 4);
  const symmetry = str(params, "symmetry", "none");
  const links = bool(params, "links", false);
  const hierarchy = bool(params, "hierarchy", true);
  const rand = rng(seed, "scatter");
  const out: Instance[] = [];
  const placed: { x: number; y: number; rank: number }[] = [];

  const emit = (x: number, y: number, scale: number, rot: number, rank: number, vi: number) => {
    for (const p of symmetricCopies({ x, y }, symmetry, width, height)) {
      const motif = varietyMotif(primary, vi, svgSource);
      out.push(
        stampMotif(`${idPrefix}-${out.length}`, motif, p.x, p.y, rot, scale, width, height, {
          colorIndex: vi + rank,
          ring: rank,
          checker: rank % 2,
          angle: rot,
          opacity: rank === 2 ? 0.9 : 1,
        }),
      );
      placed.push({ x: p.x, y: p.y, rank });
    }
  };

  if (structure === "bands") {
    const n = clamp(cols, 4, 32);
    const gap = width / n;
    const bw = gap * clamp(scaleK, 0.2, 0.92);
    for (let i = 0; i < n; i++) {
      const x = gap * i + (gap - bw) / 2;
      out.push(
        makeInstance(
          `${idPrefix}-band-${i}`,
          [{ pts: rectPoints(x, height * 0.04, bw, height * 0.92), closed: true }],
          x + bw / 2,
          height / 2,
          width,
          height,
          { colorIndex: i % Math.max(1, variety), checker: i % 2, ring: i },
        ),
      );
    }
    return cap(out);
  }

  if (structure === "rosette") {
    const recipes = [
      { n: 1, spread: 0, shape: 5, sc: 1.3 },
      { n: 8, spread: 0.11, shape: 4, sc: 0.55 },
      { n: 12, spread: 0.2, shape: 0, sc: 0.4 },
      { n: 6, spread: 0.3, shape: 6, sc: 0.7 },
      { n: 10, spread: 0.16, shape: 2, sc: 0.32 },
    ];
    recipes.forEach((recipe, ri) => {
      for (let k = 0; k < 4; k++) {
        const base = (k * Math.PI) / 2 + ri * 0.2;
        for (let i = 0; i < recipe.n; i++) {
          const ang = base + (recipe.n === 1 ? 0 : (i / recipe.n) * Math.PI * 2);
          const rad = Math.min(width, height) * recipe.spread;
          const x = width / 2 + Math.cos(ang) * rad;
          const y = height / 2 + Math.sin(ang) * rad;
          const motif = varietyMotif(primary, recipe.shape % variety, svgSource);
          out.push(
            stampMotif(`${idPrefix}-rose-${ri}-${k}-${i}`, motif, x, y, ang, Math.min(width, height) * 0.035 * recipe.sc * scaleK, width, height, {
              colorIndex: ri,
              ring: ri,
              angle: ang,
            }),
          );
        }
      }
    });
    return cap(out);
  }

  let anchors: Pt[] = [];
  if (structure === "poisson") anchors = poissonDisk(rand, width, height, spacing);
  else if (structure === "rings") {
    const ringCount = clamp(rows, 2, 8);
    for (let ring = 0; ring < ringCount; ring++) {
      const rad = (Math.min(width, height) * 0.46 * (ring + 1)) / ringCount;
      const count = 4 + ring * 3;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ring * 0.3;
        anchors.push({
          x: width / 2 + Math.cos(a) * rad,
          y: height / 2 + Math.sin(a) * rad,
        });
      }
    }
  } else if (structure === "clusters") {
    const centers = poissonDisk(rand, width, height, spacing * 2.2, 12);
    for (const center of centers) {
      anchors.push(center);
      for (let i = 0; i < clusterSize; i++) {
        const ang = rand() * Math.PI * 2;
        const rad = spacing * 0.15 + rand() * spacing * 0.85;
        anchors.push({ x: center.x + Math.cos(ang) * rad, y: center.y + Math.sin(ang) * rad });
      }
    }
  } else {
    const cw = width / cols;
    const ch = height / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = structure === "jitter" ? (rand() - 0.5) * cw * jitter : 0;
        const jy = structure === "jitter" ? (rand() - 0.5) * ch * jitter : 0;
        anchors.push({ x: cw * (c + 0.5) + jx, y: ch * (r + 0.5) + jy });
      }
    }
  }

  anchors.forEach((anchor, i) => {
    if (structure !== "clusters" && structure !== "rings" && !chance(rand, density)) return;
    if ((structure === "clusters" || structure === "rings") && rand() > density) return;
    const rank = hierarchy ? (i % 7 === 0 ? 0 : i % 3 === 0 ? 1 : 2) : 1;
    const cell = structure === "grid" || structure === "jitter" ? Math.min(width / cols, height / rows) : spacing;
    const base = structure === "rings" ? Math.min(width, height) * 0.16 * scaleK : cell * 0.42 * scaleK;
    const sc = base * (rank === 0 ? 1.45 : rank === 1 ? 1 : 0.62);
    const rot = rand() * Math.PI * 2;
    const vi = irange(rand, 0, Math.max(0, variety - 1));
    emit(anchor.x, anchor.y, sc, rot, rank, vi);
  });

  if (links && placed.length > 1) {
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]!;
      let nearest = -1;
      let best = Infinity;
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(placed[j]!.x - a.x, placed[j]!.y - a.y);
        if (d < best) {
          best = d;
          nearest = j;
        }
      }
      if (nearest < 0 || best > spacing * 1.4 || !chance(rand, 0.35)) continue;
      const b = placed[nearest]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const thick = 1.4;
      const pts = [
        { x: a.x + nx * thick, y: a.y + ny * thick },
        { x: b.x + nx * thick, y: b.y + ny * thick },
        { x: b.x - nx * thick, y: b.y - ny * thick },
        { x: a.x - nx * thick, y: a.y - ny * thick },
      ];
      out.push(
        makeInstance(`${idPrefix}-link-${i}`, [{ pts, closed: true }], (a.x + b.x) / 2, (a.y + b.y) / 2, width, height, {
          colorIndex: 3,
          opacity: 0.8,
        }),
      );
    }
  }
  return cap(out);
}
