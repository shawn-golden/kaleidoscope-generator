import { placeLinear } from "../geom";
import { applyAff, hexOrbit, squareGroup } from "../symmetry";
import { int, num, str } from "../params";
import { cap, makeInstance, stampMotif } from "../stamp";
import type { Instance, Motif, ParamField, Params } from "../types";

export const wallpaperFields: ParamField[] = [
  {
    key: "group",
    label: "Group",
    kind: "select",
    default: "p4m",
    options: ["p1", "p2", "pm", "pmm", "p4", "p4m", "p4g", "p6", "p6m"].map((value) => ({ value, label: value })),
  },
  { key: "cols", label: "Columns", kind: "int", min: 1, max: 16, step: 1, default: 4 },
  { key: "rows", label: "Rows", kind: "int", min: 1, max: 16, step: 1, default: 5 },
  { key: "scale", label: "Motif scale", kind: "number", min: 0.08, max: 0.9, step: 0.01, default: 0.28 },
  { key: "spin", label: "Spin", kind: "number", min: -180, max: 180, step: 1, default: 0 },
  { key: "ax", label: "Anchor X", kind: "number", min: 0.05, max: 0.95, step: 0.01, default: 0.68 },
  { key: "ay", label: "Anchor Y", kind: "number", min: 0.05, max: 0.95, step: 0.01, default: 0.62 },
];

export function buildWallpaper(
  params: Params,
  motif: Motif,
  width: number,
  height: number,
  idPrefix = "w",
): Instance[] {
  const group = str(params, "group", "p4m");
  const cols = int(params, "cols", 4);
  const rows = int(params, "rows", 5);
  const scaleK = num(params, "scale", 0.28);
  const spin = (num(params, "spin", 0) * Math.PI) / 180;
  const ax = num(params, "ax", 0.68);
  const ay = num(params, "ay", 0.62);
  const out: Instance[] = [];

  if (group === "p6" || group === "p6m") {
    const cell = Math.min(width / Math.max(1, cols), height / Math.max(1, rows));
    const v1 = { x: cell, y: 0 };
    const v2 = { x: cell / 2, y: (cell * Math.sqrt(3)) / 2 };
    const ox = cell * 0.2;
    const oy = cell * 0.2;
    const offset = { x: cell * 0.2, y: cell * 0.07 };
    const orbit = hexOrbit(offset.x, offset.y, group === "p6m");
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const origin = { x: ox + i * v1.x + j * v2.x, y: oy + i * v1.y + j * v2.y };
        orbit.forEach((op, k) => {
          out.push(
            stampMotif(`${idPrefix}-${i}-${j}-${k}`, motif, origin.x + op.x, origin.y + op.y, op.rot + spin, cell * scaleK, width, height, {
              flip: op.flip,
              colorIndex: k % 4,
              ring: k,
              checker: k % 2,
              angle: op.rot,
            }),
          );
        });
      }
    }
    return cap(out);
  }

  const cellW = width / cols;
  const cellH = height / rows;
  const ops = squareGroup(group);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const ox = i * cellW;
      const oy = j * cellH;
      ops.forEach((aff, k) => {
        const anchor = applyAff(aff, ax, ay);
        const sx = anchor.x - Math.floor(anchor.x);
        const sy = anchor.y - Math.floor(anchor.y);
        const x = ox + sx * cellW;
        const y = oy + sy * cellH;
        const cs = Math.cos(spin);
        const sn = Math.sin(spin);
        const a = cs * aff.a - sn * aff.b;
        const b = sn * aff.a + cs * aff.b;
        const c = cs * aff.c - sn * aff.d;
        const d = sn * aff.c + cs * aff.d;
        const sc = Math.min(cellW, cellH) * scaleK;
        out.push(
          makeInstance(`${idPrefix}-${i}-${j}-${k}`, placeLinear(motif, x, y, a, b, c, d, sc), x, y, width, height, {
            colorIndex: k % 6,
            ring: k,
            checker: k % 2,
            angle: Math.atan2(b, a),
            evenodd: motif.evenodd,
          }),
        );
      });
    }
  }
  return cap(out);
}
