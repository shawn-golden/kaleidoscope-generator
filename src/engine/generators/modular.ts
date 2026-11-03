import { arcRibbon, rectPoints } from "../geom";
import { bool, int, num, str } from "../params";
import { rng, type Rng } from "../prng";
import { cap, makeInstance, stampMotif } from "../stamp";
import type { Contour, Instance, Motif, ParamField, Params } from "../types";

export const modularFields: ParamField[] = [
  { key: "cols", label: "Columns", kind: "int", min: 3, max: 28, step: 1, default: 10 },
  { key: "rows", label: "Rows", kind: "int", min: 3, max: 28, step: 1, default: 10 },
  {
    key: "tile",
    label: "Tile",
    kind: "select",
    default: "arcs",
    options: [
      { value: "arcs", label: "Truchet arcs" },
      { value: "lanes", label: "Edge lanes" },
      { value: "lattice", label: "Square lattice" },
      { value: "diagonal", label: "Diagonal lattice" },
      { value: "dissolve", label: "Dissolving checker" },
      { value: "petals", label: "Petals" },
    ],
  },
  { key: "dissolve", label: "Dissolve", kind: "number", min: 0, max: 1, step: 0.01, default: 0.35 },
  { key: "split", label: "Color split", kind: "number", min: 0, max: 1, step: 0.01, default: 0.5 },
  { key: "weight", label: "Weight", kind: "number", min: 0.08, max: 0.48, step: 0.01, default: 0.18 },
  { key: "sourceScale", label: "Source stamp", kind: "number", min: 0, max: 0.9, step: 0.01, default: 0 },
  { key: "consistent", label: "Consistent arcs", kind: "boolean", default: false },
];

export type Socket = [number, number, number, number];

type TileDef = { sockets: Socket; kind: string };

const LANE_TILES: TileDef[] = [
  { sockets: [0, 1, 0, 1], kind: "h" },
  { sockets: [1, 0, 1, 0], kind: "v" },
  { sockets: [1, 1, 0, 0], kind: "ne" },
  { sockets: [0, 1, 1, 0], kind: "se" },
  { sockets: [0, 0, 1, 1], kind: "sw" },
  { sockets: [1, 0, 0, 1], kind: "nw" },
  { sockets: [1, 1, 1, 0], kind: "te" },
  { sockets: [1, 1, 1, 1], kind: "x" },
];

/** Greedy edge matching. North/east sockets of a tile agree with the neighbor already placed. */
export function solveLanes(cols: number, rows: number, rand: Rng): TileDef[][] {
  const grid: TileDef[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TileDef[] = [];
    for (let c = 0; c < cols; c++) {
      let best = LANE_TILES[0]!;
      let bestScore = -Infinity;
      for (const tile of LANE_TILES) {
        let score = rand() * 0.05;
        if (c > 0) score += tile.sockets[3] === row[c - 1]!.sockets[1] ? 2 : -3;
        if (r > 0) score += tile.sockets[0] === grid[r - 1]![c]!.sockets[2] ? 2 : -3;
        if (score > bestScore) {
          bestScore = score;
          best = tile;
        }
      }
      row.push(best);
    }
    grid.push(row);
  }
  return grid;
}

function elbow(x: number, y: number, s: number, dir: string, t: number): Contour[] {
  const m = s / 2;
  const h = t / 2;
  const horiz = (x0: number, x1: number, y0: number) => rectPoints(x0, y0 - h, x1 - x0, t);
  const vert = (y0: number, y1: number, x0: number) => rectPoints(x0 - h, y0, t, y1 - y0);
  if (dir === "h") return [{ pts: horiz(x, x + s, y + m), closed: true }];
  if (dir === "v") return [{ pts: vert(y, y + s, x + m), closed: true }];
  const arms: Record<string, Contour[]> = {
    ne: [
      { pts: vert(y, y + m + h, x + m), closed: true },
      { pts: horiz(x + m - h, x + s, y + m), closed: true },
    ],
    se: [
      { pts: vert(y + m - h, y + s, x + m), closed: true },
      { pts: horiz(x + m - h, x + s, y + m), closed: true },
    ],
    sw: [
      { pts: vert(y + m - h, y + s, x + m), closed: true },
      { pts: horiz(x, x + m + h, y + m), closed: true },
    ],
    nw: [
      { pts: vert(y, y + m + h, x + m), closed: true },
      { pts: horiz(x, x + m + h, y + m), closed: true },
    ],
    te: [
      { pts: vert(y, y + m, x + m), closed: true },
      { pts: horiz(x, x + s, y + m), closed: true },
    ],
    x: [
      { pts: vert(y, y + s, x + m), closed: true },
      { pts: horiz(x, x + s, y + m), closed: true },
    ],
  };
  return arms[dir] ?? arms.h!;
}

export function buildModular(
  params: Params,
  motif: Motif,
  seed: string,
  width: number,
  height: number,
  idPrefix = "mod",
): Instance[] {
  const cols = int(params, "cols", 10);
  const rows = int(params, "rows", 10);
  const tile = str(params, "tile", "arcs");
  const dissolve = num(params, "dissolve", 0.35);
  const split = num(params, "split", 0.5);
  const weight = num(params, "weight", 0.18);
  const sourceScale = num(params, "sourceScale", 0);
  const consistent = bool(params, "consistent", false);
  const rand = rng(seed, "modular");
  const cw = width / cols;
  const ch = height / rows;
  const out: Instance[] = [];
  const lanes = tile === "lanes" ? solveLanes(cols, rows, rand) : null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const y = r * ch;
      const cx = x + cw / 2;
      const cy = y + ch / 2;
      const region = c / cols + (r / rows) * 0.35 > split ? 1 : 0;
      const noise = rand();
      const keep = tile === "dissolve" ? c / cols + noise * 0.55 > dissolve : tile === "diagonal" ? noise > dissolve * (1 - c / cols) * 0.85 || c / cols > 0.28 : true;
      if (!keep && tile !== "lanes" && tile !== "arcs" && tile !== "petals" && tile !== "lattice") continue;

      const push = (suffix: string, contours: Contour[], color: number, evenodd = false) => {
        out.push(
          makeInstance(`${idPrefix}-${c}-${r}-${suffix}`, contours, cx, cy, width, height, {
            colorIndex: color,
            checker: (c + r) % 2,
            ring: r,
            evenodd,
          }),
        );
      };

      if (tile === "arcs") {
        const orient = consistent ? (c + r) % 2 : noise > 0.5 ? 1 : 0;
        const rad = Math.min(cw, ch) * 0.5;
        const thick = Math.min(cw, ch) * weight;
        const corners =
          orient === 0
            ? [
                [x, y, 0, Math.PI / 2],
                [x + cw, y + ch, Math.PI, Math.PI * 1.5],
              ]
            : [
                [x + cw, y, Math.PI / 2, Math.PI],
                [x, y + ch, -Math.PI / 2, 0],
              ];
        corners.forEach((corner, i) => {
          const [ax, ay, a0, a1] = corner as number[];
          push(
            `a${i}`,
            [{ pts: arcRibbon(ax!, ay!, rad! - thick, rad!, a0!, a1!, 8), closed: true }],
            (c + r + i) % 2,
          );
        });
      } else if (tile === "lanes" && lanes) {
        const def = lanes[r]![c]!;
        push("lane", elbow(x, y, cw, def.kind, Math.min(cw, ch) * weight * 1.4), region);
      } else if (tile === "lattice") {
        const diamond = (c + r) % 2 === 0;
        if (diamond) {
          const m = Math.min(cw, ch) * 0.34;
          push(
            "d",
            [
              {
                pts: [
                  { x: cx, y: cy - m },
                  { x: cx + m, y: cy },
                  { x: cx, y: cy + m },
                  { x: cx - m, y: cy },
                ],
                closed: true,
              },
            ],
            region,
          );
        } else {
          const inset = Math.min(cw, ch) * 0.18;
          const t = Math.min(cw, ch) * weight;
          push(
            "sq",
            [
              { pts: rectPoints(x + inset, y + inset, cw - inset * 2, ch - inset * 2), closed: true },
              {
                pts: rectPoints(x + inset + t, y + inset + t, cw - (inset + t) * 2, ch - (inset + t) * 2),
                closed: true,
              },
            ],
            region,
            true,
          );
        }
      } else if (tile === "diagonal") {
        const m = Math.min(cw, ch) * 0.46;
        const inner = m * 0.42;
        push(
          "dia",
          [
            {
              pts: [
                { x: cx, y: cy - m },
                { x: cx + m, y: cy },
                { x: cx, y: cy + m },
                { x: cx - m, y: cy },
              ],
              closed: true,
            },
          ],
          region,
        );
        if ((c + r) % 2 === 0) {
          push(
            "in",
            [
              {
                pts: [
                  { x: cx, y: cy - inner },
                  { x: cx + inner, y: cy },
                  { x: cx, y: cy + inner },
                  { x: cx - inner, y: cy },
                ],
                closed: true,
              },
            ],
            region === 0 ? 1 : 0,
          );
        }
      } else if (tile === "dissolve") {
        const sub = noise > 0.72;
        if (!sub) {
          const inset = Math.min(cw, ch) * 0.04;
          push("cell", [{ pts: rectPoints(x + inset, y + inset, cw - inset * 2, ch - inset * 2), closed: true }], (c + r) % 2);
        } else {
          push(
            "tri",
            [
              {
                pts: [
                  { x, y },
                  { x: x + cw, y },
                  { x, y: y + ch },
                ],
                closed: true,
              },
            ],
            (c + r) % 2,
          );
        }
      } else if (tile === "petals") {
        const rad = Math.min(cw, ch) * 0.72;
        push(
          "petal",
          [
            { pts: arcRibbon(cx, cy, 0, rad, 0, Math.PI * 2, 20), closed: true },
          ],
          (c + r) % 4,
        );
      }

      if (sourceScale > 0) {
        out.push(
          stampMotif(`${idPrefix}-src-${c}-${r}`, motif, cx, cy, 0, Math.min(cw, ch) * sourceScale, width, height, {
            colorIndex: region + 2,
            ring: r,
            checker: (c + r) % 2,
          }),
        );
      }
    }
  }
  return cap(out);
}
