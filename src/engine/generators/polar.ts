import { arcRibbon, clamp } from "../geom";
import { bool, int, num, str } from "../params";
import { cap, makeInstance, stampMotif } from "../stamp";
import type { Instance, Motif, ParamField, Params, Pt } from "../types";

export const polarFields: ParamField[] = [
  { key: "centers", label: "Centers", kind: "int", min: 1, max: 4, step: 1, default: 1 },
  {
    key: "layout",
    label: "Layout",
    kind: "select",
    default: "single",
    options: [
      { value: "single", label: "Single" },
      { value: "vertical", label: "Vertical" },
      { value: "horizontal", label: "Horizontal" },
      { value: "diagonal", label: "Diagonal" },
      { value: "ring", label: "Ring of centers" },
    ],
  },
  { key: "rings", label: "Rings", kind: "int", min: 3, max: 36, step: 1, default: 14 },
  {
    key: "countMode",
    label: "Counts",
    kind: "select",
    default: "auto",
    options: [
      { value: "auto", label: "Square cells" },
      { value: "stepped", label: "Stepped per ring" },
    ],
  },
  { key: "baseCount", label: "Base count", kind: "int", min: 4, max: 80, step: 1, default: 18 },
  { key: "countStep", label: "Count step", kind: "int", min: -6, max: 12, step: 1, default: 2 },
  { key: "inner", label: "Inner radius", kind: "number", min: 0, max: 0.75, step: 0.01, default: 0.12 },
  { key: "twist", label: "Twist", kind: "number", min: -28, max: 28, step: 0.1, default: 6 },
  { key: "sweep", label: "Sweep", kind: "number", min: 0.35, max: 1, step: 0.01, default: 1 },
  { key: "pad", label: "Cell gap", kind: "number", min: 0, max: 0.4, step: 0.01, default: 0.08 },
  { key: "checker", label: "Checkerboard", kind: "boolean", default: true },
  {
    key: "draw",
    label: "Draw",
    kind: "select",
    default: "sectors",
    options: [
      { value: "sectors", label: "Curved cells" },
      { value: "shapes", label: "Source shapes" },
      { value: "both", label: "Cells and shapes" },
    ],
  },
];

export function polarCenters(layout: string, count: number, width: number, height: number): Pt[] {
  const n = Math.max(1, count);
  const cx = width / 2;
  const cy = height / 2;
  if (n === 1 || layout === "single") return [{ x: cx, y: cy }];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    if (layout === "horizontal") out.push({ x: cx + t * width * 0.42, y: cy });
    else if (layout === "diagonal") out.push({ x: cx + t * width * 0.34, y: cy + t * height * 0.34 });
    else if (layout === "ring") {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rad = Math.min(width, height) * 0.2;
      out.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
    } else out.push({ x: cx, y: cy + t * height * 0.4 });
  }
  return out;
}

export function ringSegmentCount(
  mode: string,
  ring: number,
  radius: number,
  thickness: number,
  sweep: number,
  base: number,
  step: number,
): number {
  if (mode === "auto") {
    const target = Math.max(8, thickness);
    return clamp(Math.round((Math.PI * 2 * radius * sweep) / target), 6, 96);
  }
  return clamp(base + ring * step, 4, 96);
}

export function buildPolar(
  params: Params,
  motif: Motif,
  width: number,
  height: number,
  idPrefix = "p",
): Instance[] {
  const layout = str(params, "layout", "single");
  const centerCount = int(params, "centers", 1);
  const rings = int(params, "rings", 14);
  const mode = str(params, "countMode", "auto");
  const base = int(params, "baseCount", 18);
  const step = int(params, "countStep", 2);
  const innerRatio = num(params, "inner", 0.12);
  const twist = (num(params, "twist", 6) * Math.PI) / 180;
  const sweep = num(params, "sweep", 1);
  const pad = num(params, "pad", 0.08);
  const checker = bool(params, "checker", true);
  const draw = str(params, "draw", "sectors");
  const centers = polarCenters(layout, centerCount, width, height);
  const reach = Math.min(width, height) * (centers.length > 1 ? 0.34 : 0.48);
  const inner = reach * innerRatio;
  const thickness = (reach - inner) / rings;
  const out: Instance[] = [];

  centers.forEach((center, ci) => {
    for (let ring = 0; ring < rings; ring++) {
      const r0 = inner + ring * thickness;
      const r1 = r0 + thickness;
      const mid = (r0 + r1) / 2;
      const count = ringSegmentCount(mode, ring, mid, thickness, sweep, base, step);
      const span = (Math.PI * 2 * sweep) / count;
      const gapA = span * pad * 0.5;
      const gapR = thickness * pad * 0.45;
      for (let s = 0; s < count; s++) {
        if (checker && (ring + s) % 2 === 1) continue;
        const a0 = s * span + ring * twist + gapA;
        const a1 = (s + 1) * span + ring * twist - gapA;
        const midA = (a0 + a1) / 2;
        const x = center.x + Math.cos(midA) * mid;
        const y = center.y + Math.sin(midA) * mid;
        if (draw !== "shapes") {
          const ribbon = arcRibbon(center.x, center.y, r0 + gapR, r1 - gapR, a0, a1, 7);
          out.push(
            makeInstance(`${idPrefix}-${ci}-${ring}-${s}`, [{ pts: ribbon, closed: true }], x, y, width, height, {
              colorIndex: checker ? ci : ring + ci,
              ring,
              checker: (ring + s) % 2,
              angle: midA,
            }),
          );
        }
        if (draw !== "sectors") {
          const sc = Math.min(thickness, span * mid) * 0.72;
          out.push(
            stampMotif(`${idPrefix}-s-${ci}-${ring}-${s}`, motif, x, y, midA, sc, width, height, {
              colorIndex: ring + 1,
              ring,
              checker: (ring + s) % 2,
              angle: midA,
            }),
          );
        }
      }
    }
  });
  return cap(out);
}
