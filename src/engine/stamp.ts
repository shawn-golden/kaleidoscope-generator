import { signedArea } from "./geom";
import { placeMotif } from "./geom";
import type { Contour, Instance, Motif } from "./types";

export function makeInstance(
  id: string,
  contours: Contour[],
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<Instance> = {},
): Instance {
  const first = contours[0];
  const area = first && first.pts.length >= 3 ? signedArea(first.pts) : 0;
  return {
    id,
    contours,
    x,
    y,
    colorIndex: extra.colorIndex ?? 0,
    ring: extra.ring ?? 0,
    checker: extra.checker ?? 0,
    u: width > 0 ? x / width : 0,
    v: height > 0 ? y / height : 0,
    angle: extra.angle ?? 0,
    opacity: extra.opacity ?? 1,
    evenodd: extra.evenodd,
    chirality: area === 0 ? 0 : Math.sign(area),
  };
}

export function stampMotif(
  id: string,
  motif: Motif,
  x: number,
  y: number,
  rot: number,
  scale: number,
  width: number,
  height: number,
  extra: Partial<Instance> & { flip?: boolean } = {},
): Instance {
  const contours = placeMotif(motif, x, y, rot, scale, extra.flip ?? false);
  return makeInstance(id, contours, x, y, width, height, { ...extra, evenodd: extra.evenodd ?? motif.evenodd });
}

export const MAX_INSTANCES = 7000;

export function cap(instances: Instance[]): Instance[] {
  return instances.length > MAX_INSTANCES ? instances.slice(0, MAX_INSTANCES) : instances;
}
