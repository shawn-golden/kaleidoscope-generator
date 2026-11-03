import { arcPoints, circlePoints, polygon, rectPoints, starPoints } from "./geom";
import type { Motif, ShapeId } from "./types";

const closed = (pts: Motif["contours"][0]["pts"]): Motif["contours"][0] => ({ pts, closed: true });

function ribbonArc(a0: number, a1: number, r0: number, r1: number): Motif["contours"][0] {
  const outer = arcPoints(0, 0, r1, a0, a1, 14);
  const inner = arcPoints(0, 0, r0, a1, a0, 14);
  return closed(outer.concat(inner));
}

export function shapeMotif(id: ShapeId): Motif {
  switch (id) {
    case "square":
      return { contours: [closed(rectPoints(-0.5, -0.5, 1, 1))] };
    case "rect":
      return { contours: [closed(rectPoints(-0.5, -0.32, 1, 0.64))] };
    case "circle":
      return { contours: [closed(circlePoints(0, 0, 0.5, 32))] };
    case "triangle":
      return { contours: [closed(polygon(3, 0.52))] };
    case "diamond":
      return {
        contours: [
          closed([
            { x: 0, y: -0.56 },
            { x: 0.4, y: 0 },
            { x: 0, y: 0.56 },
            { x: -0.4, y: 0 },
          ]),
        ],
      };
    case "cross":
      return {
        contours: [
          closed(rectPoints(-0.16, -0.5, 0.32, 1)),
          closed(rectPoints(-0.5, -0.16, 1, 0.32)),
        ],
      };
    case "asterisk": {
      const arm = rectPoints(-0.08, -0.5, 0.16, 1);
      const rot = (deg: number) => {
        const a = (deg * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        return arm.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
      };
      return { contours: [closed(rot(0)), closed(rot(45)), closed(rot(90)), closed(rot(135))] };
    }
    case "star":
      return { contours: [closed(starPoints(5, 0.52, 0.22))] };
    case "line":
      return { contours: [closed(rectPoints(-0.5, -0.06, 1, 0.12))] };
    case "arc":
      return { contours: [ribbonArc(-Math.PI * 0.15, Math.PI * 1.05, 0.28, 0.5)] };
    case "quarter":
      return {
        contours: [
          closed([
            { x: 0, y: 0 },
            ...arcPoints(0, 0, 0.5, -Math.PI / 2, 0, 12),
          ]),
        ],
      };
    case "semicircle":
      return {
        contours: [
          closed([
            { x: -0.5, y: 0 },
            ...arcPoints(0, 0, 0.5, Math.PI, 0, 16),
          ]),
        ],
      };
    case "l":
      return {
        contours: [
          closed([
            { x: -0.5, y: -0.5 },
            { x: 0.12, y: -0.5 },
            { x: 0.12, y: 0.08 },
            { x: -0.16, y: 0.08 },
            { x: -0.16, y: 0.5 },
            { x: -0.5, y: 0.5 },
          ]),
        ],
      };
    case "chevron":
      return {
        contours: [
          closed([
            { x: -0.5, y: -0.42 },
            { x: 0.08, y: -0.42 },
            { x: 0.5, y: 0 },
            { x: 0.08, y: 0.42 },
            { x: -0.5, y: 0.42 },
            { x: -0.1, y: 0 },
          ]),
        ],
      };
    case "ring":
      return {
        evenodd: true,
        contours: [closed(circlePoints(0, 0, 0.5, 32)), closed(circlePoints(0, 0, 0.28, 28))],
      };
    case "compound":
      return {
        contours: [
          closed(circlePoints(0, 0, 0.18, 20)),
          closed(starPoints(4, 0.5, 0.18)),
          closed(
            rectPoints(-0.16, -0.16, 0.12, 0.12).map((p) => ({ x: p.x - 0.28, y: p.y - 0.28 })),
          ),
          closed(
            polygon(3, 0.16, 0).map((p) => ({ x: p.x + 0.28, y: p.y + 0.22 })),
          ),
        ],
      };
    default:
      return { contours: [closed(rectPoints(-0.5, -0.5, 1, 1))] };
  }
}

export const SHAPE_LABELS: Record<ShapeId, string> = {
  square: "Square",
  rect: "Rectangle",
  circle: "Circle",
  triangle: "Triangle",
  diamond: "Diamond",
  cross: "Cross",
  asterisk: "Asterisk",
  star: "Star",
  line: "Line",
  arc: "Arc",
  quarter: "Quarter circle",
  semicircle: "Semicircle",
  l: "L shape",
  chevron: "Chevron",
  ring: "Ring",
  compound: "Compound",
};
