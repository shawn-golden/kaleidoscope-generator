import type { Params, ParamField } from "./types";

export function num(p: Params, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function int(p: Params, key: string, fallback: number): number {
  return Math.round(num(p, key, fallback));
}

export function bool(p: Params, key: string, fallback: boolean): boolean {
  const v = p[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(p: Params, key: string, fallback: string): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

export function defaults(fields: ParamField[]): Params {
  const out: Params = {};
  for (const f of fields) out[f.key] = f.default;
  return out;
}

export function clampParam(field: ParamField, value: number | string | boolean): number | string | boolean {
  if ((field.kind === "number" || field.kind === "int") && typeof value === "number") {
    let v = value;
    if (field.min != null) v = Math.max(field.min, v);
    if (field.max != null) v = Math.min(field.max, v);
    if (field.kind === "int") v = Math.round(v);
    return v;
  }
  if (field.kind === "select" && typeof value === "string" && field.options) {
    return field.options.some((o) => o.value === value) ? value : field.default;
  }
  if (field.kind === "boolean") return Boolean(value);
  return field.default;
}
