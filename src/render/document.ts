import { pathD } from "../engine/geom";
import { buildScene } from "../engine/pipeline";
import { poseInstances } from "../engine/pose";
import type { Appearance, Instance, Layer, PoseContext, PosedInstance, Scene } from "../engine/types";

export function paletteColor(palette: string[], index: number): string {
  if (!palette.length) return "#111111";
  const i = ((Math.round(index) % palette.length) + palette.length) % palette.length;
  return palette[i]!;
}

export function fillFor(appearance: Appearance, layerId: string, colorIndex: number): string {
  if (!appearance.fillEnabled) return "none";
  if (appearance.fillStyle === "local") return `url(#local-${layerId})`;
  if (appearance.fillStyle === "global") return `url(#global-${layerId})`;
  return paletteColor(appearance.palette, colorIndex);
}

function gradientStops(appearance: Appearance): string {
  const colors = appearance.palette.length ? appearance.palette : ["#111111", "#ffffff"];
  return colors
    .map((color, i) => {
      const offset = colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100;
      const opacity = appearance.softEdge && i === colors.length - 1 ? 0 : 1;
      return `<stop offset="${offset}%" stop-color="${color}" stop-opacity="${opacity}"/>`;
    })
    .join("");
}

function defsFor(layer: Layer): string {
  const id = layer.id;
  const stops = gradientStops(layer.appearance);
  const angle = (layer.appearance.gradientAngle * Math.PI) / 180;
  const x2 = (0.5 + Math.cos(angle) * 0.5).toFixed(3);
  const y2 = (0.5 + Math.sin(angle) * 0.5).toFixed(3);
  const local =
    layer.appearance.gradientKind === "radial"
      ? `<radialGradient id="local-${id}" cx="35%" cy="30%" r="75%">${stops}</radialGradient>`
      : `<linearGradient id="local-${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  const global =
    layer.appearance.gradientKind === "radial"
      ? `<radialGradient id="global-${id}" gradientUnits="userSpaceOnUse" cx="50%" cy="50%" r="55%">${stops}</radialGradient>`
      : `<linearGradient id="global-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
  const dots = `<pattern id="dots-${id}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="0.9" fill="#081018" fill-opacity="0.45"/></pattern>`;
  const clip =
    layer.clip === "circle"
      ? `<clipPath id="clip-${id}"><circle cx="50%" cy="50%" r="46%"/></clipPath>`
      : layer.clip === "round"
        ? `<clipPath id="clip-${id}"><rect x="4%" y="4%" width="92%" height="92%" rx="48"/></clipPath>`
        : "";
  return local + global + dots + clip;
}

export function renderSvg(
  scene: Scene,
  layers: { layer: Layer; instances: PosedInstance[] }[],
): string {
  const { width: w, height: h } = scene;
  const body = layers
    .map(({ layer, instances }) => {
      if (!layer.visible) return "";
      const paths = instances
        .map((inst) => {
          const fill = fillFor(layer.appearance, layer.id, inst.colorIndex);
          const stroke = layer.appearance.strokeEnabled ? layer.appearance.stroke : "none";
          const rule = inst.evenodd ? ` fill-rule="evenodd"` : "";
          const d = pathD(inst.contours);
          const main = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${layer.appearance.strokeWidth}" opacity="${inst.opacity}"${rule}/>`;
          if (layer.appearance.texture !== "dots" || !layer.appearance.fillEnabled) return main;
          return main + `<path d="${d}" fill="url(#dots-${layer.id})" opacity="0.55"${rule}/>`;
        })
        .join("");
      const clip = layer.clip === "none" ? "" : ` clip-path="url(#clip-${layer.id})"`;
      const blend = layer.blend === "normal" ? "" : ` style="mix-blend-mode:${layer.blend}"`;
      return `<g opacity="${layer.opacity}"${clip}${blend}>${paths}</g>`;
    })
    .join("");
  const defs = layers.map(({ layer }) => defsFor(layer)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}<clipPath id="board"><rect width="${w}" height="${h}"/></clipPath></defs><rect width="${w}" height="${h}" fill="${scene.background}"/><g clip-path="url(#board)">${body}</g></svg>`;
}

export function posedDocument(scene: Scene, time: number, pointer: { x: number; y: number } | null, ripples: PoseContext["ripples"], reducedMotion: boolean) {
  const built = buildScene(scene);
  const layers = built.layers.map(({ layer, instances }) => ({
    layer,
    instances: poseInstances(instances, {
      time,
      seed: scene.seed,
      motion: scene.motion,
      interaction: scene.interaction,
      pointer,
      ripples,
      reducedMotion,
    }),
  }));
  return { built, layers, svg: renderSvg(scene, layers) };
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function svgToPngBlob(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("PNG encoding failed");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterize SVG"));
    image.src = url;
  });
}

export function canRecordVideo(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, file.data);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + file.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const blobParts = [...parts, ...central, end].map((part) => {
    const copy = new Uint8Array(part.byteLength);
    copy.set(part);
    return copy;
  });
  return new Blob(blobParts, { type: "application/zip" });
}

export function interactiveHtml(scene: Scene, instancesByLayer: { layer: Layer; instances: Instance[] }[]): string {
  const payload = {
    width: scene.width,
    height: scene.height,
    background: scene.background,
    motion: scene.motion,
    interaction: scene.interaction,
    layers: instancesByLayer.map(({ layer, instances }) => ({
      id: layer.id,
      opacity: layer.opacity,
      blend: layer.blend,
      clip: layer.clip,
      appearance: layer.appearance,
      instances: instances.map((inst) => ({
        x: inst.x,
        y: inst.y,
        colorIndex: inst.colorIndex,
        opacity: inst.opacity,
        evenodd: !!inst.evenodd,
        u: inst.u,
        contours: inst.contours.map((ct) => ({ closed: ct.closed, pts: ct.pts })),
      })),
    })),
  };
  const defs = `<defs>${instancesByLayer.map(({ layer }) => defsFor(layer)).join("")}<clipPath id="board"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs>`;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<title>${escapeHtml(scene.name)} · Kaleidoscope</title>
<style>
  html,body{margin:0;height:100%;background:#1b1714;color:#f4f1ea;font-family:sans-serif}
  svg{width:100%;height:100%;display:block;touch-action:none}
  p{position:fixed;left:12px;bottom:10px;margin:0;font-size:12px;opacity:.7}
</style>
<body>
<svg id="stage"></svg>
<p>Interactive export. Move and click. Reduced motion follows the browser setting.</p>
<script type="application/json" id="scene">${JSON.stringify(payload).replaceAll("<", "\\u003c")}</script>
<script>
const scene = JSON.parse(document.getElementById("scene").textContent);
const defs = ${JSON.stringify(defs)};
const svg = document.getElementById("stage");
svg.setAttribute("viewBox", "0 0 "+scene.width+" "+scene.height);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ripples = [];
let pointer = null;
let time = 0;
let last = 0;
function pal(colors, index){ if(!colors.length) return "#111"; const i=((index%colors.length)+colors.length)%colors.length; return colors[i]; }
function fill(layer, index){
  const a = layer.appearance;
  if(!a.fillEnabled) return "none";
  if(a.fillStyle==="local") return "url(#local-"+layer.id+")";
  if(a.fillStyle==="global") return "url(#global-"+layer.id+")";
  return pal(a.palette, index);
}
function path(contours){
  let d="";
  for(const ct of contours){
    if(!ct.pts.length) continue;
    d += "M"+ct.pts[0].x.toFixed(2)+" "+ct.pts[0].y.toFixed(2);
    for(let i=1;i<ct.pts.length;i++) d += "L"+ct.pts[i].x.toFixed(2)+" "+ct.pts[i].y.toFixed(2);
    if(ct.closed) d += "Z";
  }
  return d;
}
function falloff(dist, radius){ if(radius<=0) return 0; const t=Math.max(0, Math.min(1, 1-dist/radius)); return t*t*(3-2*t); }
function field(x,y){
  const ix = scene.interaction;
  if(!ix.enabled) return [0,0];
  if(ix.preset==="ripple"){
    if(reduced) return [0,0];
    let sx=0, sy=0;
    for(const src of ripples){
      const t = time - src.t0; if(t<0) continue;
      const dx=x-src.x, dy=y-src.y; const dist=Math.hypot(dx,dy)||1e-6;
      const phase = dist - ix.rippleSpeed * t;
      const wave = Math.sin(2*Math.PI*phase/ix.wavelength);
      const envelope = Math.exp(-0.5*(phase/ix.width)**2);
      const decay = Math.exp(-t/ix.decay);
      const amp = wave*envelope*decay*ix.amplitude;
      sx += dx/dist*amp; sy += dy/dist*amp;
    }
    return [sx,sy];
  }
  if(!pointer || ix.preset==="color") return [0,0];
  const dx=x-pointer.x, dy=y-pointer.y, dist=Math.hypot(dx,dy);
  const f = falloff(dist, ix.radius)*ix.strength;
  if(ix.preset==="magnet") return [(pointer.x-x)*f,(pointer.y-y)*f];
  if(ix.preset==="repulsion" || ix.preset==="lens") return [dx*f, dy*f];
  if(ix.preset==="swirl"){
    const ang=f*2.4, c=Math.cos(ang), s=Math.sin(ang);
    return [pointer.x + dx*c - dy*s - x, pointer.y + dx*s + dy*c - y];
  }
  return [0,0];
}
function posePoint(p, inst){
  const m = scene.motion;
  let x=p.x, y=p.y;
  if(!reduced && (m.playing || m.rotation || m.pulse || m.waveAmp)){
    let ang = (m.rotation*Math.PI/180)*time;
    if(m.phase==="byRadius") ang += Math.hypot(inst.u-0.5, 0)*4;
    if(m.phase==="byIndex") ang += inst.colorIndex*0.35;
    const c=Math.cos(ang), s=Math.sin(ang);
    const dx=x-inst.x, dy=y-inst.y;
    x = inst.x + dx*c - dy*s; y = inst.y + dx*s + dy*c;
    const pulse = 1 + m.pulse*Math.sin(time*m.pulseSpeed*Math.PI*2 + inst.u*6.283);
    x = inst.x + (x-inst.x)*pulse; y = inst.y + (y-inst.y)*pulse;
    if(m.waveAmp){
      const w = Math.sin(2*Math.PI*(p.y - m.waveSpeed*time)/Math.max(4,m.wavelength))*m.waveAmp;
      x += w;
    }
  }
  const ix = scene.interaction;
  const rigid = ix.displaceInstances ? field(inst.x, inst.y) : [0,0];
  const local = ix.deformGeometry ? field(p.x, p.y) : [0,0];
  const d = ix.displaceInstances || ix.deformGeometry ? (ix.deformGeometry ? local : rigid) : [0,0];
  return [x+d[0], y+d[1]];
}
function draw(now){
  if(!last) last = now;
  const dt = (now-last)/1000; last = now;
  if(scene.motion.playing && !reduced) time += dt * (scene.motion.speed||1);
  let html = defs + '<g clip-path="url(#board)"><rect width="'+scene.width+'" height="'+scene.height+'" fill="'+scene.background+'"/>';
  for(const layer of scene.layers){
    const clip = layer.clip && layer.clip !== "none" ? ' clip-path="url(#clip-'+layer.id+')"' : "";
    const blend = layer.blend && layer.blend !== "normal" ? ' style="mix-blend-mode:'+layer.blend+'"' : "";
    html += '<g opacity="'+layer.opacity+'"'+clip+blend+'>';
    for(const inst of layer.instances){
      let color = inst.colorIndex;
      if(scene.interaction.enabled && scene.interaction.preset==="color" && pointer){
        const dist = Math.hypot(inst.x-pointer.x, inst.y-pointer.y);
        color += Math.round(falloff(dist, scene.interaction.radius)*scene.interaction.strength*4);
      }
      const contours = inst.contours.map(ct => ({closed:ct.closed, pts: ct.pts.map(p => { const q=posePoint(p, inst); return {x:q[0], y:q[1]}; })}));
      const d = path(contours);
      const a = layer.appearance;
      const stroke = a.strokeEnabled ? a.stroke : "none";
      const rule = inst.evenodd ? ' fill-rule="evenodd"' : "";
      html += '<path d="'+d+'" fill="'+fill(layer, color)+'" stroke="'+stroke+'" stroke-width="'+(a.strokeWidth||0)+'" opacity="'+inst.opacity+'"'+rule+'/>';
      if(a.texture==="dots" && a.fillEnabled) html += '<path d="'+d+'" fill="url(#dots-'+layer.id+')" opacity="0.55"'+rule+'/>';
    }
    html += '</g>';
  }
  html += '</g>';
  svg.innerHTML = html;
  requestAnimationFrame(draw);
}
svg.addEventListener("pointerdown", (e) => {
  const p = client(e); pointer = p;
  ripples.push({x:p.x,y:p.y,t0:time});
  while(ripples.length > (scene.interaction.maxSources||8)) ripples.shift();
});
svg.addEventListener("pointermove", (e) => {
  const p = client(e); pointer = p;
  if(e.buttons && scene.interaction.preset==="ripple"){
    const lastRip = ripples[ripples.length-1];
    if(!lastRip || Math.hypot(p.x-lastRip.x, p.y-lastRip.y) > 24){
      ripples.push({x:p.x,y:p.y,t0:time});
      while(ripples.length > (scene.interaction.maxSources||8)) ripples.shift();
    }
  }
});
svg.addEventListener("pointerleave", () => { pointer = null; });
function client(e){
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const ctm = svg.getScreenCTM(); if(!ctm) return {x:0,y:0};
  const q = pt.matrixTransform(ctm.inverse());
  return {x:q.x, y:q.y};
}
scene.motion.playing = true;
scene.interaction.enabled = true;
requestAnimationFrame(draw);
</script>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}
