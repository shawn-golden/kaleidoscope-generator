import { rectPoints } from "../geom";
import { int, num, str } from "../params";
import { chance, irange, rng } from "../prng";
import { cap, makeInstance } from "../stamp";
import type { Instance, ParamField, Params, ShapeId } from "../types";

export const mosaicFields: ParamField[] = [
  { key: "cols", label: "Columns", kind: "int", min: 6, max: 72, step: 1, default: 32 },
  { key: "rows", label: "Rows", kind: "int", min: 6, max: 72, step: 1, default: 40 },
  {
    key: "symmetry",
    label: "Symmetry",
    kind: "select",
    default: "bilateral",
    options: [
      { value: "none", label: "None" },
      { value: "bilateral", label: "Bilateral" },
      { value: "vertical", label: "Vertical mirror" },
      { value: "quadrant", label: "Quadrant" },
      { value: "rot2", label: "Rotational 2" },
      { value: "rot4", label: "Rotational 4" },
    ],
  },
  { key: "occupancy", label: "Occupancy", kind: "number", min: 0.05, max: 1, step: 0.01, default: 0.62 },
  {
    key: "motif",
    label: "Motif",
    kind: "select",
    default: "auto",
    options: [
      { value: "auto", label: "From source" },
      { value: "mixed", label: "Mixed" },
      { value: "cell", label: "Cell" },
      { value: "bar", label: "Bar" },
      { value: "block", label: "Block" },
      { value: "plus", label: "Plus" },
      { value: "corner", label: "Corner" },
    ],
  },
  { key: "frame", label: "Frame", kind: "int", min: 0, max: 6, step: 1, default: 2 },
  { key: "gap", label: "Gap", kind: "number", min: 0, max: 0.45, step: 0.01, default: 0.08 },
  { key: "colors", label: "Interior colors", kind: "int", min: 1, max: 8, step: 1, default: 4 },
];

type Cell = { c: number; r: number };

const MOTIFS: Record<string, Cell[]> = {
  cell: [{ c: 0, r: 0 }],
  bar: [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
  ],
  block: [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
    { c: 0, r: 1 },
    { c: 1, r: 1 },
  ],
  plus: [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
    { c: -1, r: 0 },
    { c: 0, r: 1 },
    { c: 0, r: -1 },
  ],
  corner: [
    { c: 0, r: 0 },
    { c: 1, r: 0 },
    { c: 0, r: 1 },
  ],
};

export function motifFromShape(shape: ShapeId): keyof typeof MOTIFS {
  switch (shape) {
    case "rect":
    case "line":
      return "bar";
    case "cross":
    case "asterisk":
    case "star":
      return "plus";
    case "l":
    case "chevron":
    case "quarter":
    case "arc":
    case "semicircle":
    case "triangle":
      return "corner";
    case "square":
    case "diamond":
      return "block";
    case "compound":
      return "cell";
    default:
      return "cell";
  }
}

function imagesOf(c: number, r: number, cols: number, rows: number, symmetry: string): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  const push = (c2: number, r2: number) => {
    const cc = Math.round(c2);
    const rr = Math.round(r2);
    if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) return;
    const k = `${cc},${rr}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ c: cc, r: rr });
  };
  push(c, r);
  if (symmetry === "bilateral" || symmetry === "quadrant") push(cols - 1 - c, r);
  if (symmetry === "vertical" || symmetry === "quadrant") push(c, rows - 1 - r);
  if (symmetry === "quadrant") push(cols - 1 - c, rows - 1 - r);
  if (symmetry === "rot2") push(cols - 1 - c, rows - 1 - r);
  if (symmetry === "rot4") {
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    let x = c - cx;
    let y = r - cy;
    for (let k = 0; k < 3; k++) {
      const nx = -y;
      const ny = x;
      x = nx;
      y = ny;
      push(x + cx, y + cy);
    }
  }
  return out;
}

function isFundamental(c: number, r: number, cols: number, rows: number, symmetry: string): boolean {
  const imgs = imagesOf(c, r, cols, rows, symmetry);
  let best = Infinity;
  for (const p of imgs) best = Math.min(best, p.r * cols + p.c);
  return best === r * cols + c;
}

export type MosaicCell = { c: number; r: number; color: number };

export function mosaicCells(params: Params, seed: string, shape: ShapeId = "square"): MosaicCell[] {
  const cols = int(params, "cols", 32);
  const rows = int(params, "rows", 40);
  const symmetry = str(params, "symmetry", "bilateral");
  const occupancy = num(params, "occupancy", 0.62);
  const motifMode = str(params, "motif", "auto");
  const frame = int(params, "frame", 2);
  const colors = Math.max(1, int(params, "colors", 4));
  const rand = rng(seed, "mosaic");
  const filled = new Map<string, number>();

  const choices =
    motifMode === "mixed"
      ? ["cell", "bar", "block", "plus", "corner"]
      : motifMode === "auto"
        ? [motifFromShape(shape)]
        : [motifMode];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < frame || r < frame || c >= cols - frame || r >= rows - frame) continue;
      if (!isFundamental(c, r, cols, rows, symmetry)) continue;
      if (!chance(rand, occupancy)) continue;
      const kind = choices[irange(rand, 0, choices.length - 1)] ?? "cell";
      const shapeCells = MOTIFS[kind] ?? MOTIFS.cell!;
      const placed = shapeCells.map((p) => ({ c: c + p.c, r: r + p.r }));
      if (placed.some((p) => p.c < frame || p.r < frame || p.c >= cols - frame || p.r >= rows - frame)) continue;
      if (placed.some((p) => !isFundamental(p.c, p.r, cols, rows, symmetry))) continue;
      const color = 2 + Math.floor(rand() * colors);
      for (const p of placed) {
        for (const img of imagesOf(p.c, p.r, cols, rows, symmetry)) {
          filled.set(`${img.c},${img.r}`, color);
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (frame > 0 && (c < frame || r < frame || c >= cols - frame || r >= rows - frame)) {
        filled.set(`${c},${r}`, (c + r) % 2);
      }
    }
  }

  const cells: MosaicCell[] = [];
  for (const [key, color] of filled) {
    const [c, r] = key.split(",").map(Number);
    cells.push({ c: c!, r: r!, color });
  }
  return cells;
}

export function buildMosaic(
  params: Params,
  seed: string,
  width: number,
  height: number,
  shape: ShapeId,
  idPrefix = "m",
): Instance[] {
  const cols = int(params, "cols", 32);
  const rows = int(params, "rows", 40);
  const gap = num(params, "gap", 0.08);
  const gx = width / cols;
  const gy = height / rows;
  const inset = Math.min(gx, gy) * gap * 0.5;
  const cells = mosaicCells(params, seed, shape);
  const out: Instance[] = [];
  for (const cell of cells) {
    const x = cell.c * gx + inset;
    const y = cell.r * gy + inset;
    const rw = Math.max(0.5, gx - inset * 2);
    const rh = Math.max(0.5, gy - inset * 2);
    const cx = x + rw / 2;
    const cy = y + rh / 2;
    out.push(
      makeInstance(
        `${idPrefix}-${cell.c}-${cell.r}`,
        [{ pts: rectPoints(x, y, rw, rh), closed: true }],
        cx,
        cy,
        width,
        height,
        { colorIndex: cell.color, checker: (cell.c + cell.r) % 2, ring: cell.r },
      ),
    );
  }
  return cap(out);
}
