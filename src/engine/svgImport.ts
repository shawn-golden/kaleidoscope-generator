import { boundsOf, normalizeMotif } from "./geom";
import type { Contour, Motif, Pt } from "./types";

const ALLOWED = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "line",
]);

const DROP = new Set([
  "script",
  "foreignobject",
  "iframe",
  "image",
  "use",
  "animate",
  "animatetransform",
  "animatemotion",
  "set",
  "style",
  "title",
  "desc",
  "metadata",
]);

/**
 * Strip active content and convert the remaining drawing elements into a unit motif.
 * The returned markup is a sanitized re-serialization, never the raw input.
 */
export function sanitizeSvg(markup: string): { markup: string; motif: Motif } {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return empty();
  stripDanger(svg);
  const contours: Contour[] = [];
  walk(svg, identity(), contours);
  const motif = normalizeMotif({ contours: contours.filter((c) => c.pts.length > 1) }, 1);
  if (motif.contours.length === 0) return empty();
  return { markup: motifToSvg(motif), motif };
}

function empty(): { markup: string; motif: Motif } {
  return { markup: "", motif: { contours: [] } };
}

function stripDanger(root: Element) {
  const all = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const el of all) {
    if (DROP.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (name === "href" || name === "xlink:href") el.removeAttribute(attr.name);
      else if ((name === "style" || name === "fill" || name === "stroke") && /javascript:|expression\(|url\s*\(\s*['"]?https?:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

type M = [number, number, number, number, number, number];

function identity(): M {
  return [1, 0, 0, 1, 0, 0];
}

function mul(a: M, b: M): M {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function apply(m: M, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

function parseTransform(raw: string | null): M {
  if (!raw) return identity();
  let m = identity();
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const kind = match[1]!;
    const n = match[2]!.split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
    let next = identity();
    if (kind === "matrix" && n.length >= 6) next = [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!];
    else if (kind === "translate") next = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (kind === "scale") next = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (kind === "rotate") {
      const a = ((n[0] ?? 0) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rot: M = [c, s, -s, c, 0, 0];
      if (n.length >= 3) {
        const tx = n[1] ?? 0;
        const ty = n[2] ?? 0;
        next = mul(mul([1, 0, 0, 1, tx, ty], rot), [1, 0, 0, 1, -tx, -ty]);
      } else next = rot;
    } else if (kind === "skewX") {
      const t = Math.tan(((n[0] ?? 0) * Math.PI) / 180);
      next = [1, 0, t, 1, 0, 0];
    } else if (kind === "skewY") {
      const t = Math.tan(((n[0] ?? 0) * Math.PI) / 180);
      next = [1, t, 0, 1, 0, 0];
    }
    m = mul(m, next);
  }
  return m;
}

function num(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function walk(el: Element, parent: M, out: Contour[]) {
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return;
  if (!ALLOWED.has(tag) && tag !== "svg") return;
  const local = mul(parent, parseTransform(el.getAttribute("transform")));
  if (tag === "rect") {
    const x = num(el, "x");
    const y = num(el, "y");
    const w = num(el, "width");
    const h = num(el, "height");
    if (w > 0 && h > 0) push(out, local, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true);
  } else if (tag === "circle") {
    push(out, local, ellipse(num(el, "cx"), num(el, "cy"), num(el, "r"), num(el, "r")), true);
  } else if (tag === "ellipse") {
    push(out, local, ellipse(num(el, "cx"), num(el, "cy"), num(el, "rx"), num(el, "ry")), true);
  } else if (tag === "line") {
    push(
      out,
      local,
      [
        { x: num(el, "x1"), y: num(el, "y1") },
        { x: num(el, "x2"), y: num(el, "y2") },
      ],
      false,
    );
  } else if (tag === "polygon" || tag === "polyline") {
    const pts = parsePoints(el.getAttribute("points") ?? "");
    if (pts.length) push(out, local, pts, tag === "polygon");
  } else if (tag === "path") {
    for (const sub of parsePath(el.getAttribute("d") ?? "")) push(out, local, sub.pts, sub.closed);
  }
  for (const child of Array.from(el.children)) walk(child, local, out);
}

function push(out: Contour[], m: M, pts: Pt[], isClosed: boolean) {
  if (pts.length < 2) return;
  out.push({ closed: isClosed, pts: pts.map((p) => apply(m, p)) });
}

function ellipse(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const n = 28;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function parsePoints(raw: string): Pt[] {
  const n = raw.trim().split(/[\s,]+/).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) pts.push({ x: n[i]!, y: n[i + 1]! });
  }
  return pts;
}

type Sub = { pts: Pt[]; closed: boolean };

function parsePath(d: string): Sub[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevCtrl: Pt | null = null;
  const subs: Sub[] = [];
  let cur: Sub | null = null;

  const read = () => Number(tokens[i++]);
  const hasNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]!);

  const start = (x: number, y: number) => {
    if (cur && cur.pts.length) subs.push(cur);
    cur = { pts: [{ x, y }], closed: false };
    cx = sx = x;
    cy = sy = y;
    prevCtrl = null;
  };
  const lineTo = (x: number, y: number) => {
    cur?.pts.push({ x, y });
    cx = x;
    cy = y;
    prevCtrl = null;
  };
  const cubic = (c1: Pt, c2: Pt, end: Pt) => {
    const from = { x: cx, y: cy };
    const flat = flattenCubic(from, c1, c2, end, 0);
    cur?.pts.push(...flat.slice(1));
    cx = end.x;
    cy = end.y;
    prevCtrl = c2;
  };

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    if (c === "M") {
      const x = read();
      const y = read();
      const nx = rel ? cx + x : x;
      const ny = rel ? cy + y : y;
      start(nx, ny);
      cmd = rel ? "l" : "L";
      while (hasNum()) {
        const lx = read();
        const ly = read();
        lineTo(rel ? cx + lx : lx, rel ? cy + ly : ly);
      }
    } else if (c === "L") {
      while (hasNum()) {
        const x = read();
        const y = read();
        lineTo(rel ? cx + x : x, rel ? cy + y : y);
      }
    } else if (c === "H") {
      while (hasNum()) {
        const x = read();
        lineTo(rel ? cx + x : x, cy);
      }
    } else if (c === "V") {
      while (hasNum()) {
        const y = read();
        lineTo(cx, rel ? cy + y : y);
      }
    } else if (c === "C") {
      while (hasNum()) {
        const nums = [read(), read(), read(), read(), read(), read()];
        const abs = (x: number, y: number) => ({ x: rel ? cx + x : x, y: rel ? cy + y : y });
        cubic(abs(nums[0]!, nums[1]!), abs(nums[2]!, nums[3]!), abs(nums[4]!, nums[5]!));
      }
    } else if (c === "S") {
      while (hasNum()) {
        const nums = [read(), read(), read(), read()];
        const abs = (x: number, y: number) => ({ x: rel ? cx + x : x, y: rel ? cy + y : y });
        const c2 = abs(nums[0]!, nums[1]!);
        const end = abs(nums[2]!, nums[3]!);
        const prev = prevCtrl as Pt | null;
        const c1 = prev ? { x: cx * 2 - prev.x, y: cy * 2 - prev.y } : { x: cx, y: cy };
        cubic(c1, c2, end);
      }
    } else if (c === "Q") {
      while (hasNum()) {
        const nums = [read(), read(), read(), read()];
        const abs = (x: number, y: number) => ({ x: rel ? cx + x : x, y: rel ? cy + y : y });
        const q = abs(nums[0]!, nums[1]!);
        const end = abs(nums[2]!, nums[3]!);
        const c1 = { x: cx + (2 / 3) * (q.x - cx), y: cy + (2 / 3) * (q.y - cy) };
        const c2 = { x: end.x + (2 / 3) * (q.x - end.x), y: end.y + (2 / 3) * (q.y - end.y) };
        cubic(c1, c2, end);
      }
    } else if (c === "T") {
      while (hasNum()) {
        const nums = [read(), read()];
        const end = { x: rel ? cx + nums[0]! : nums[0]!, y: rel ? cy + nums[1]! : nums[1]! };
        const prev = prevCtrl as Pt | null;
        const q = prev ? { x: cx * 2 - prev.x, y: cy * 2 - prev.y } : { x: cx, y: cy };
        const c1 = { x: cx + (2 / 3) * (q.x - cx), y: cy + (2 / 3) * (q.y - cy) };
        const c2 = { x: end.x + (2 / 3) * (q.x - end.x), y: end.y + (2 / 3) * (q.y - end.y) };
        cubic(c1, c2, end);
      }
    } else if (c === "A") {
      while (hasNum()) {
        read();
        read();
        read();
        read();
        read();
        const x = read();
        const y = read();
        lineTo(rel ? cx + x : x, rel ? cy + y : y);
      }
    } else if (c === "Z") {
      const current = cur as Sub | null;
      if (current) {
        current.closed = true;
        cx = sx;
        cy = sy;
      }
      prevCtrl = null;
    } else break;
  }
  const last = cur as Sub | null;
  if (last && last.pts.length) subs.push(last);
  return subs;
}

function flattenCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, depth: number): Pt[] {
  const flat = depth > 6 || isFlat(p0, p1, p2, p3);
  if (flat) return [p0, p3];
  const m = splitCubic(p0, p1, p2, p3);
  const a = flattenCubic(m[0], m[1], m[2], m[3], depth + 1);
  const b = flattenCubic(m[3], m[4], m[5], m[6], depth + 1);
  return a.concat(b.slice(1));
}

function isFlat(p0: Pt, p1: Pt, p2: Pt, p3: Pt): boolean {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const d1 = Math.abs(dy * p1.x - dx * p1.y + p3.x * p0.y - p3.y * p0.x);
  const d2 = Math.abs(dy * p2.x - dx * p2.y + p3.x * p0.y - p3.y * p0.x);
  return d1 + d2 <= 0.8 * Math.hypot(dx, dy);
}

function splitCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt[] {
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const p01 = mid(p0, p1);
  const p12 = mid(p1, p2);
  const p23 = mid(p2, p3);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  const p0123 = mid(p012, p123);
  return [p0, p01, p012, p0123, p123, p23, p3];
}

function motifToSvg(motif: Motif): string {
  const b = boundsOf(motif.contours);
  const pad = 4;
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  const d = motif.contours
    .map((ct) => {
      if (!ct.pts.length) return "";
      const head = ct.pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");
      return head + (ct.closed ? "Z" : "");
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}"><path d="${d}" fill="currentColor"/></svg>`;
}
