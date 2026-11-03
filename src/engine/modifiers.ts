import { clamp, gaussian, mapContours } from "./geom";
import { defaults, num, str } from "./params";
import { rng } from "./prng";
import type { Instance, ModifierInstance, ParamField, Params } from "./types";

export const modifierFields: Record<string, ParamField[]> = {
  wave: [
    {
      key: "axis",
      label: "Axis",
      kind: "select",
      default: "x",
      options: [
        { value: "x", label: "Horizontal" },
        { value: "y", label: "Vertical" },
        { value: "radial", label: "Radial" },
      ],
    },
    { key: "amplitude", label: "Amplitude", kind: "number", min: 0, max: 80, step: 0.5, default: 12 },
    { key: "wavelength", label: "Wavelength", kind: "number", min: 8, max: 400, step: 1, default: 48 },
    { key: "phase", label: "Phase", kind: "number", min: 0, max: 6.28, step: 0.01, default: 0 },
  ],
  mask: [
    {
      key: "field",
      label: "Field",
      kind: "select",
      default: "radial",
      options: [
        { value: "radial", label: "Radial" },
        { value: "linear", label: "Linear" },
        { value: "noise", label: "Noise" },
      ],
    },
    { key: "threshold", label: "Threshold", kind: "number", min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: "softness", label: "Softness", kind: "number", min: 0, max: 0.5, step: 0.01, default: 0.08 },
    {
      key: "mode",
      label: "Mode",
      kind: "select",
      default: "drop",
      options: [
        { value: "drop", label: "Drop" },
        { value: "scale", label: "Scale" },
      ],
    },
  ],
  pinch: [
    { key: "amount", label: "Amount", kind: "number", min: 0, max: 0.95, step: 0.01, default: 0.55 },
    { key: "width", label: "Width", kind: "number", min: 20, max: 500, step: 1, default: 140 },
  ],
  jitter: [{ key: "amount", label: "Amount", kind: "number", min: 0, max: 40, step: 0.5, default: 6 }],
};

export const MODIFIER_ORDER = ["wave", "mask", "pinch", "jitter"] as const;

export function defaultModifiers(): ModifierInstance[] {
  return MODIFIER_ORDER.map((id) => ({
    id,
    enabled: false,
    params: defaults(modifierFields[id]!),
  }));
}

export function applyModifier(mod: ModifierInstance, instances: Instance[], seed: string, width: number, height: number): Instance[] {
  if (!mod.enabled) return instances;
  if (mod.id === "wave") return applyWave(instances, mod.params, width, height);
  if (mod.id === "mask") return applyMask(instances, mod.params, seed, width, height);
  if (mod.id === "pinch") return applyPinch(instances, mod.params, width, height);
  if (mod.id === "jitter") return applyJitter(instances, mod.params, seed);
  return instances;
}

function applyWave(instances: Instance[], params: Params, width: number, height: number): Instance[] {
  const axis = str(params, "axis", "x");
  const amp = num(params, "amplitude", 12);
  const wavelength = Math.max(4, num(params, "wavelength", 48));
  const phase = num(params, "phase", 0);
  const cx = width / 2;
  const cy = height / 2;
  return instances.map((inst) => ({
    ...inst,
    contours: mapContours(inst.contours, (p) => {
      if (axis === "radial") {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const w = Math.sin((Math.PI * 2 * dist) / wavelength + phase) * amp;
        return { x: p.x + (dx / dist) * w, y: p.y + (dy / dist) * w };
      }
      const w = Math.sin((Math.PI * 2 * (axis === "x" ? p.y : p.x)) / wavelength + phase) * amp;
      return axis === "x" ? { x: p.x + w, y: p.y } : { x: p.x, y: p.y + w };
    }),
  }));
}

function applyMask(instances: Instance[], params: Params, seed: string, _width: number, _height: number): Instance[] {
  void _width;
  void _height;
  const field = str(params, "field", "radial");
  const threshold = num(params, "threshold", 0.35);
  const softness = num(params, "softness", 0.08);
  const mode = str(params, "mode", "drop");
  const rand = rng(seed, "mask");
  const noiseAt = new Map<string, number>();
  const sample = (inst: Instance) => {
    if (field === "linear") return 1 - inst.u;
    if (field === "noise") {
      const key = `${Math.round(inst.u * 16)},${Math.round(inst.v * 16)}`;
      let v = noiseAt.get(key);
      if (v == null) {
        v = rand();
        noiseAt.set(key, v);
      }
      return v;
    }
    return 1 - Math.min(1, Math.hypot(inst.u - 0.5, inst.v - 0.5) * 1.8);
  };
  const out: Instance[] = [];
  for (const inst of instances) {
    const value = sample(inst);
    if (mode === "scale") {
      const f = clamp((value - threshold) / Math.max(0.04, softness) + 0.35, 0.15, 1);
      out.push({
        ...inst,
        contours: mapContours(inst.contours, (p) => ({
          x: inst.x + (p.x - inst.x) * f,
          y: inst.y + (p.y - inst.y) * f,
        })),
      });
    } else if (value >= threshold - softness) out.push(inst);
  }
  return out;
}

function applyPinch(instances: Instance[], params: Params, width: number, height: number): Instance[] {
  const amount = num(params, "amount", 0.55);
  const widthK = num(params, "width", 140);
  const cx = width / 2;
  const cy = height / 2;
  return instances.map((inst) => {
    const move = (p: { x: number; y: number }) => {
      const g = gaussian(p.y - cy, widthK);
      return {
        x: cx + (p.x - cx) * (1 - amount * g),
        y: cy + (p.y - cy) * (1 - amount * 0.45 * g),
      };
    };
    const pivot = move({ x: inst.x, y: inst.y });
    return {
      ...inst,
      x: pivot.x,
      y: pivot.y,
      contours: mapContours(inst.contours, move),
    };
  });
}

function applyJitter(instances: Instance[], params: Params, seed: string): Instance[] {
  const amount = num(params, "amount", 6);
  const rand = rng(seed, "jitter");
  return instances.map((inst) => {
    const dx = (rand() - 0.5) * 2 * amount;
    const dy = (rand() - 0.5) * 2 * amount;
    return {
      ...inst,
      x: inst.x + dx,
      y: inst.y + dy,
      contours: mapContours(inst.contours, (p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  });
}
