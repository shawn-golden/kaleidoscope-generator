import { friezeOps } from "../symmetry";
import { int, num, str } from "../params";
import { cap, stampMotif } from "../stamp";
import type { Instance, Motif, ParamField, Params } from "../types";

export const friezeFields: ParamField[] = [
  {
    key: "group",
    label: "Group",
    kind: "select",
    default: "p2mm",
    options: [
      { value: "p111", label: "p111 hop" },
      { value: "p1m1", label: "p1m1 jump" },
      { value: "p11m", label: "p11m sidle" },
      { value: "p11g", label: "p11g step" },
      { value: "p211", label: "p211 spin" },
      { value: "p2mm", label: "p2mm spin jump" },
      { value: "p2mg", label: "p2mg spin sidle" },
    ],
  },
  { key: "repeats", label: "Repeats", kind: "int", min: 2, max: 18, step: 1, default: 7 },
  { key: "bands", label: "Bands", kind: "int", min: 1, max: 6, step: 1, default: 3 },
  { key: "scale", label: "Motif scale", kind: "number", min: 0.15, max: 1.2, step: 0.01, default: 0.55 },
  { key: "gap", label: "Gap", kind: "number", min: 0, max: 0.5, step: 0.01, default: 0.12 },
];

export function buildFrieze(
  params: Params,
  motif: Motif,
  width: number,
  height: number,
  idPrefix = "f",
): Instance[] {
  const group = str(params, "group", "p2mm");
  const repeats = int(params, "repeats", 7);
  const bands = int(params, "bands", 3);
  const scaleK = num(params, "scale", 0.55);
  const gap = num(params, "gap", 0.12);
  const ops = friezeOps(group);
  const period = width / repeats;
  const bandH = height / bands;
  const sc = Math.min(period, bandH) * scaleK * (1 - gap);
  const out: Instance[] = [];
  for (let b = 0; b < bands; b++) {
    const cy = bandH * (b + 0.5);
    for (let i = 0; i < repeats; i++) {
      const ox = period * i;
      ops.forEach((op, k) => {
        const x = ox + period * 0.5 + op.x * period;
        const y = cy + op.y * bandH;
        out.push(
          stampMotif(`${idPrefix}-${b}-${i}-${k}`, motif, x, y, op.rot + b * 0.15, sc, width, height, {
            flip: op.flip,
            colorIndex: b + k,
            ring: b,
            checker: (i + b) % 2,
            angle: op.rot,
          }),
        );
      });
    }
  }
  return cap(out);
}
