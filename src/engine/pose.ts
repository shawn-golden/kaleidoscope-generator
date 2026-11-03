import { clamp, gaussian, rotatePt, smoothFalloff } from "./geom";
import type { Contour, Instance, Interaction, Motion, PoseContext, PosedInstance, Pt, RippleSource } from "./types";

/**
 * Traveling ripple evaluated at a resting point.
 * phase = distance - speed * t
 * wave = sin(2π phase / wavelength)
 * envelope = exp(-0.5 (phase / width)^2)
 * decay = exp(-t / decay)
 */
export function rippleVector(x: number, y: number, sources: RippleSource[], time: number, interaction: Interaction): Pt {
  let sx = 0;
  let sy = 0;
  for (const src of sources) {
    const t = time - src.t0;
    if (t < 0) continue;
    const dx = x - src.x;
    const dy = y - src.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const phase = dist - interaction.rippleSpeed * t;
    const wave = Math.sin((Math.PI * 2 * phase) / interaction.wavelength);
    const envelope = Math.exp(-0.5 * (phase / interaction.width) ** 2);
    const decay = Math.exp(-t / interaction.decay);
    const amp = wave * envelope * decay * interaction.amplitude;
    sx += (dx / dist) * amp;
    sy += (dy / dist) * amp;
  }
  return { x: sx, y: sy };
}

export function pushRipple(sources: RippleSource[], source: RippleSource, maxSources: number): RippleSource[] {
  const next = sources.filter((s) => source.t0 - s.t0 < Math.max(4, s.kind === "move" ? 6 : 10));
  next.push(source);
  while (next.length > Math.max(1, maxSources)) next.shift();
  return next;
}

function motionPoint(p: Pt, inst: Instance, motion: Motion, time: number, reduced: boolean): Pt {
  if (reduced) return { x: p.x, y: p.y };
  const t = time;
  let ang = ((motion.rotation * Math.PI) / 180) * t;
  if (motion.phase === "byRadius") ang += Math.hypot(inst.u - 0.5, inst.v - 0.5) * 4;
  if (motion.phase === "byIndex") ang += inst.colorIndex * 0.35;
  let q = rotatePt(p, ang, inst.x, inst.y);
  const pulse = 1 + motion.pulse * Math.sin(t * motion.pulseSpeed * Math.PI * 2 + inst.u * 6.283);
  q = {
    x: inst.x + (q.x - inst.x) * pulse,
    y: inst.y + (q.y - inst.y) * pulse,
  };
  if (motion.waveAmp !== 0) {
    const phase = p.y - motion.waveSpeed * t;
    const w = Math.sin((Math.PI * 2 * phase) / Math.max(4, motion.wavelength)) * motion.waveAmp;
    q = { x: q.x + w, y: q.y };
  }
  return q;
}

function interactionVector(
  x: number,
  y: number,
  ctx: PoseContext,
): Pt {
  const { interaction: ix, pointer } = ctx;
  if (!ix.enabled) return { x: 0, y: 0 };
  if (ix.preset === "ripple") {
    if (ctx.reducedMotion) return { x: 0, y: 0 };
    return rippleVector(x, y, ctx.ripples, ctx.time, ix);
  }
  if (!pointer || ix.preset === "color") return { x: 0, y: 0 };
  const dx = x - pointer.x;
  const dy = y - pointer.y;
  const dist = Math.hypot(dx, dy);
  const fall = smoothFalloff(dist, ix.radius) * ix.strength;
  if (ix.preset === "magnet") return { x: (pointer.x - x) * fall, y: (pointer.y - y) * fall };
  if (ix.preset === "repulsion") return { x: dx * fall, y: dy * fall };
  if (ix.preset === "lens") return { x: dx * fall, y: dy * fall };
  if (ix.preset === "swirl") {
    const ang = fall * 2.4;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const nx = pointer.x + dx * c - dy * s;
    const ny = pointer.y + dx * s + dy * c;
    return { x: nx - x, y: ny - y };
  }
  return { x: 0, y: 0 };
}

function poseContours(inst: Instance, ctx: PoseContext): Contour[] {
  const ix = ctx.interaction;
  return inst.contours.map((ct) => ({
    closed: ct.closed,
    pts: ct.pts.map((p) => {
      const moved = motionPoint(p, inst, ctx.motion, ctx.time, ctx.reducedMotion);
      if (!ix.enabled) return moved;
      const rigid = ix.displaceInstances ? interactionVector(inst.x, inst.y, ctx) : { x: 0, y: 0 };
      const local = ix.deformGeometry ? interactionVector(p.x, p.y, ctx) : { x: 0, y: 0 };
      let dx = 0;
      let dy = 0;
      if (ix.displaceInstances && ix.deformGeometry) {
        dx = local.x;
        dy = local.y;
      } else if (ix.displaceInstances) {
        dx = rigid.x;
        dy = rigid.y;
      } else if (ix.deformGeometry) {
        dx = local.x;
        dy = local.y;
      }
      return { x: moved.x + dx, y: moved.y + dy };
    }),
  }));
}

export function poseInstances(instances: Instance[], ctx: PoseContext): PosedInstance[] {
  return instances.map((inst) => {
    let colorIndex = inst.colorIndex;
    let opacity = inst.opacity;
    if (ctx.interaction.enabled && ctx.interaction.preset === "color" && ctx.pointer) {
      const dist = Math.hypot(inst.x - ctx.pointer.x, inst.y - ctx.pointer.y);
      const fall = smoothFalloff(dist, ctx.interaction.radius);
      colorIndex += Math.round(fall * ctx.interaction.strength * 4);
      opacity = clamp(opacity + fall * 0.25, 0, 1);
    }
    return {
      id: inst.id,
      contours: poseContours(inst, ctx),
      colorIndex,
      opacity,
      evenodd: inst.evenodd,
      u: inst.u,
      v: inst.v,
    };
  });
}

export function rippleEnvelope(phase: number, width: number): number {
  return gaussian(phase, width);
}
