import { arcRibbon, rectPoints } from "../geom";
import { bool, int, num, str } from "../params";
import { cap, makeInstance, stampMotif } from "../stamp";
import type { Instance, Motif, ParamField, Params } from "../types";
import { buildKaleidoscope } from "./kaleidoscope";
import { buildPolar } from "./polar";

export const recursiveFields: ParamField[] = [
  { key: "depth", label: "Depth", kind: "int", min: 1, max: 5, step: 1, default: 4 },
  {
    key: "frame",
    label: "Frame",
    kind: "select",
    default: "rect",
    options: [
      { value: "rect", label: "Rectangle" },
      { value: "round", label: "Rounded" },
      { value: "arch", label: "Arch" },
    ],
  },
  {
    key: "motif",
    label: "Edge motif",
    kind: "select",
    default: "arc",
    options: [
      { value: "arc", label: "Arc" },
      { value: "chevron", label: "Chevron" },
      { value: "source", label: "Source" },
      { value: "line", label: "Line" },
    ],
  },
  { key: "inset", label: "Inset", kind: "number", min: 0.04, max: 0.2, step: 0.01, default: 0.08 },
  { key: "flip", label: "Alternate flip", kind: "boolean", default: true },
  {
    key: "inner",
    label: "Inner pattern",
    kind: "select",
    default: "kaleidoscope",
    options: [
      { value: "none", label: "Empty" },
      { value: "kaleidoscope", label: "Kaleidoscope" },
      { value: "polar", label: "Polar" },
    ],
  },
];

export function buildRecursive(
  params: Params,
  motif: Motif,
  seed: string,
  width: number,
  height: number,
  idPrefix = "r",
): Instance[] {
  const depth = int(params, "depth", 4);
  const frame = str(params, "frame", "rect");
  const edge = str(params, "motif", "arc");
  const insetK = num(params, "inset", 0.08);
  const flipAlt = bool(params, "flip", true);
  const inner = str(params, "inner", "kaleidoscope");
  const out: Instance[] = [];
  const margin = Math.min(width, height) * 0.06;

  for (let d = 0; d < depth; d++) {
    const inset = margin + d * Math.min(width, height) * insetK;
    const x0 = inset;
    const y0 = inset;
    const x1 = width - inset;
    const y1 = height - inset;
    if (x1 - x0 < 40 || y1 - y0 < 40) break;
    const t = Math.max(6, Math.min(width, height) * 0.012);
    if (frame === "rect") {
      out.push(
        makeInstance(
          `${idPrefix}-frame-${d}`,
          [
            { pts: rectPoints(x0, y0, x1 - x0, y1 - y0), closed: true },
            { pts: rectPoints(x0 + t, y0 + t, x1 - x0 - t * 2, y1 - y0 - t * 2), closed: true },
          ],
          (x0 + x1) / 2,
          (y0 + y1) / 2,
          width,
          height,
          { evenodd: true, colorIndex: d % 3, ring: d, checker: d % 2 },
        ),
      );
    } else {
      out.push(
        makeInstance(
          `${idPrefix}-frame-${d}`,
          [{ pts: arcRibbon((x0 + x1) / 2, (y0 + y1) / 2, Math.min(x1 - x0, y1 - y0) * 0.5 - t * 2, Math.min(x1 - x0, y1 - y0) * 0.5, 0, Math.PI * 2, 24), closed: true }],
          (x0 + x1) / 2,
          (y0 + y1) / 2,
          width,
          height,
          { colorIndex: d % 3, ring: d },
        ),
      );
    }

    const edges = [
      { x: x0, y: y0, len: x1 - x0, horiz: true },
      { x: x0, y: y1, len: x1 - x0, horiz: true },
      { x: x0, y: y0, len: y1 - y0, horiz: false },
      { x: x1, y: y0, len: y1 - y0, horiz: false },
    ];
    edges.forEach((ed, ei) => {
      const count = Math.max(3, Math.round(ed.len / (Math.min(width, height) * 0.08)));
      for (let i = 1; i < count; i++) {
        const u = i / count;
        const x = ed.horiz ? ed.x + ed.len * u : ed.x;
        const y = ed.horiz ? ed.y : ed.y + ed.len * u;
        const rot = ed.horiz ? 0 : Math.PI / 2;
        const flip = flipAlt && (d + ei) % 2 === 1;
        if (edge === "line") {
          const len = Math.min(width, height) * 0.03;
          out.push(
            makeInstance(
              `${idPrefix}-ln-${d}-${ei}-${i}`,
              [{ pts: rectPoints(-len / 2, -t / 2, len, t), closed: true }],
              x,
              y,
              width,
              height,
              { colorIndex: d, ring: d },
            ),
          );
        } else if (edge === "arc") {
          const rad = Math.min(width, height) * 0.03;
          const a0 = ed.horiz ? Math.PI : -Math.PI / 2;
          out.push(
            makeInstance(
              `${idPrefix}-arc-${d}-${ei}-${i}`,
              [{ pts: arcRibbon(x, y, rad * 0.2, rad, a0, a0 + Math.PI, 8), closed: true }],
              x,
              y,
              width,
              height,
              { colorIndex: (d + i) % 4, ring: d, checker: i % 2 },
            ),
          );
        } else {
          out.push(
            stampMotif(`${idPrefix}-m-${d}-${ei}-${i}`, motif, x, y, rot, Math.min(width, height) * 0.035, width, height, {
              flip,
              colorIndex: d,
              ring: d,
            }),
          );
        }
      }
    });
  }

  if (inner === "kaleidoscope") {
    const innerInstances = buildKaleidoscope(
      { sectors: 6, reflect: true, rings: 3, inner: 0.1, copies: 1, offset: 8, break: 0.02, scale: 0.55, spin: 0 },
      motif,
      seed,
      width * 0.5,
      height * 0.5,
      `${idPrefix}-in`,
    ).map((inst) => ({
      ...inst,
      x: inst.x + width * 0.25,
      y: inst.y + height * 0.25,
      u: (inst.x + width * 0.25) / width,
      v: (inst.y + height * 0.25) / height,
      contours: inst.contours.map((ct) => ({
        closed: ct.closed,
        pts: ct.pts.map((p) => ({ x: p.x + width * 0.25, y: p.y + height * 0.25 })),
      })),
    }));
    out.push(...innerInstances);
  } else if (inner === "polar") {
    const innerInstances = buildPolar(
      {
        centers: 1,
        layout: "single",
        rings: 8,
        countMode: "auto",
        baseCount: 16,
        countStep: 0,
        inner: 0.15,
        twist: 5,
        sweep: 1,
        pad: 0.1,
        checker: true,
        draw: "sectors",
      },
      motif,
      width * 0.46,
      height * 0.46,
      `${idPrefix}-in`,
    ).map((inst) => ({
      ...inst,
      x: inst.x + width * 0.27,
      y: inst.y + height * 0.27,
      contours: inst.contours.map((ct) => ({
        closed: ct.closed,
        pts: ct.pts.map((p) => ({ x: p.x + width * 0.27, y: p.y + height * 0.27 })),
      })),
    }));
    out.push(...innerInstances);
  }
  return cap(out);
}
