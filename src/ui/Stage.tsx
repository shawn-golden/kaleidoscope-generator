import { useEffect, useMemo, useRef, useState, type WheelEvent as ReactWheel } from "react";
import { pathD } from "../engine/geom";
import { buildScene } from "../engine/pipeline";
import { poseInstances, pushRipple } from "../engine/pose";
import type { Appearance, Pt } from "../engine/types";
import { fillFor } from "../render/document";
import { runtime } from "../render/runtime";
import { useStudio } from "../store";

const SVG_NS = "http://www.w3.org/2000/svg";

function clientToWorld(svg: SVGSVGElement, node: SVGGElement, clientX: number, clientY: number): Pt {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = node.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const mapped = point.matrixTransform(ctm.inverse());
  return { x: mapped.x, y: mapped.y };
}

export function Stage() {
  const scene = useStudio((s) => s.scene);
  const mode = useStudio((s) => s.mode);
  const reduced = useStudio((s) => s.reducedMotion);
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef<SVGGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const [fps, setFps] = useState("–");
  const sceneRef = useRef(scene);
  const modeRef = useRef(mode);
  const reducedRef = useRef(reduced);
  sceneRef.current = scene;
  modeRef.current = mode;
  reducedRef.current = reduced;
  const built = useMemo(() => buildScene(scene), [scene]);
  const nodes = useRef(new Map<string, SVGPathElement>());

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.replaceChildren();
    nodes.current.clear();
    const defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML = built.layers
      .map(({ layer }) => gradientMarkup(layer.id, layer.appearance))
      .join("");
    for (const { layer } of built.layers) {
      if (layer.clip === "none") continue;
      const clip = document.createElementNS(SVG_NS, "clipPath");
      clip.id = `clip-${layer.id}`;
      const shape = document.createElementNS(SVG_NS, layer.clip === "circle" ? "circle" : "rect");
      if (layer.clip === "circle") {
        shape.setAttribute("cx", String(scene.width / 2));
        shape.setAttribute("cy", String(scene.height / 2));
        shape.setAttribute("r", String(Math.min(scene.width, scene.height) * 0.46));
      } else {
        shape.setAttribute("x", String(scene.width * 0.04));
        shape.setAttribute("y", String(scene.height * 0.04));
        shape.setAttribute("width", String(scene.width * 0.92));
        shape.setAttribute("height", String(scene.height * 0.92));
        shape.setAttribute("rx", "36");
      }
      clip.append(shape);
      defs.append(clip);
    }
    const boardClip = document.createElementNS(SVG_NS, "clipPath");
    boardClip.id = "board-clip";
    const boardRect = document.createElementNS(SVG_NS, "rect");
    boardRect.setAttribute("width", String(scene.width));
    boardRect.setAttribute("height", String(scene.height));
    boardClip.append(boardRect);
    defs.append(boardClip);
    world.append(defs);
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("width", String(scene.width));
    bg.setAttribute("height", String(scene.height));
    bg.setAttribute("fill", scene.background);
    world.append(bg);
    const content = document.createElementNS(SVG_NS, "g");
    content.setAttribute("clip-path", "url(#board-clip)");
    for (const { layer, instances } of built.layers) {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("opacity", String(layer.opacity));
      if (layer.blend !== "normal") group.style.mixBlendMode = layer.blend;
      if (layer.clip !== "none") group.setAttribute("clip-path", `url(#clip-${layer.id})`);
      for (const inst of instances) {
        const path = document.createElementNS(SVG_NS, "path");
        path.dataset.inst = inst.id;
        path.setAttribute("fill", fillFor(layer.appearance, layer.id, inst.colorIndex));
        path.setAttribute("fill-rule", inst.evenodd ? "evenodd" : "nonzero");
        if (layer.appearance.strokeEnabled) {
          path.setAttribute("stroke", layer.appearance.stroke);
          path.setAttribute("stroke-width", String(layer.appearance.strokeWidth));
        }
        path.setAttribute("d", pathD(inst.contours));
        path.setAttribute("opacity", String(inst.opacity));
        group.append(path);
        nodes.current.set(inst.id, path);
        if (layer.appearance.texture === "dots" && layer.appearance.fillEnabled) {
          const dots = document.createElementNS(SVG_NS, "path");
          dots.setAttribute("fill", `url(#dots-${layer.id})`);
          dots.setAttribute("opacity", "0.55");
          dots.setAttribute("d", pathD(inst.contours));
          group.append(dots);
          nodes.current.set(`${inst.id}:dots`, dots);
        }
      }
      content.append(group);
    }
    world.append(content);
  }, [built, scene.background, scene.width, scene.height]);

  useEffect(() => {
    viewRef.current?.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.zoom})`);
  }, [view]);

  useEffect(() => {
    let frame = 0;
    let frames = 0;
    let stamp = performance.now();
    let lastTick = 0;
    const paint = (now: number) => {
      const current = sceneRef.current;
      const playing = current.motion.playing && !reducedRef.current;
      if (!lastTick) lastTick = now;
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      if (playing) runtime.time += dt * current.motion.speed;
      const interacting = modeRef.current === "interact" && current.interaction.enabled;
      runtime.ripples = runtime.ripples.filter((source) => runtime.time - source.t0 < current.interaction.decay * 8 + 0.5);
      const moving = playing || frames === 0 || (interacting && (runtime.pointer !== null || runtime.ripples.length > 0));
      if (moving || frames === 0) {
        const posed = built.layers.flatMap(({ layer, instances }) =>
          poseInstances(instances, {
            time: runtime.time,
            seed: current.seed,
            motion: current.motion,
            interaction: { ...current.interaction, enabled: interacting },
            pointer: runtime.pointer,
            ripples: runtime.ripples,
            reducedMotion: reducedRef.current,
          }).map((inst) => ({ layer, inst })),
        );
        for (const { layer, inst } of posed) {
          const node = nodes.current.get(inst.id);
          if (!node) continue;
          node.setAttribute("d", pathD(inst.contours));
          node.setAttribute("fill", fillFor(layer.appearance, layer.id, inst.colorIndex));
          node.setAttribute("opacity", String(inst.opacity));
          nodes.current.get(`${inst.id}:dots`)?.setAttribute("d", pathD(inst.contours));
        }
      }
      frames += 1;
      if (now - stamp > 500) {
        setFps(`${Math.round((frames * 1000) / (now - stamp))}`);
        frames = 0;
        stamp = now;
      }
    };
    const loop = (now: number) => {
      paint(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [built]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const fit = () => {
      const pad = 64;
      if (svg.clientWidth < 40 || svg.clientHeight < 40) return;
      const zoom = Math.min((svg.clientWidth - pad) / scene.width, (svg.clientHeight - pad) / scene.height);
      setView({
        zoom,
        x: (svg.clientWidth - scene.width * zoom) / 2,
        y: (svg.clientHeight - scene.height * zoom) / 2,
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [scene.width, scene.height, setView]);

  const onWheel = (event: ReactWheel<SVGSVGElement>) => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;
    const before = clientToWorld(svg, world, event.clientX, event.clientY);
    const next = Math.min(8, Math.max(0.08, view.zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
    const rect = svg.getBoundingClientRect();
    setView({
      zoom: next,
      x: event.clientX - rect.left - before.x * next,
      y: event.clientY - rect.top - before.y * next,
    });
  };

  const drag = useRef<{ kind: "pan" | "draw"; x: number; y: number; vx: number; vy: number } | null>(null);

  return (
    <div className="stage-wrap relative h-full min-h-0 bg-well">
      <svg
        ref={svgRef}
        data-testid="artboard"
        className="h-full w-full touch-none"
        onWheel={onWheel}
        onPointerDown={(event) => {
          const svg = svgRef.current;
          const world = worldRef.current;
          if (!svg || !world) return;
          (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
          const point = clientToWorld(svg, world, event.clientX, event.clientY);
          if (mode === "interact" && !runtime.space && event.button === 0) {
            runtime.pointer = point;
            runtime.ripples = pushRipple(runtime.ripples, { x: point.x, y: point.y, t0: runtime.time, kind: "click" }, scene.interaction.maxSources);
            drag.current = { kind: "draw", x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
          } else {
            drag.current = { kind: "pan", x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
          }
        }}
        onPointerMove={(event) => {
          const svg = svgRef.current;
          const world = worldRef.current;
          if (!svg || !world) return;
          const point = clientToWorld(svg, world, event.clientX, event.clientY);
          if (mode === "interact") runtime.pointer = point;
          const current = drag.current;
          if (!current) return;
          if (current.kind === "pan") {
            setView({ zoom: view.zoom, x: current.vx + event.clientX - current.x, y: current.vy + event.clientY - current.y });
          } else if (scene.interaction.preset === "ripple") {
            const last = runtime.ripples[runtime.ripples.length - 1];
            if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 28) {
              runtime.ripples = pushRipple(runtime.ripples, { x: point.x, y: point.y, t0: runtime.time, kind: "move" }, scene.interaction.maxSources);
            }
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          if (mode === "interact" && !drag.current) runtime.pointer = null;
          drag.current = null;
        }}
      >
        <g ref={viewRef}>
          <g ref={worldRef} />
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] text-paper">
        <span>{fps} fps</span>
        <span className="mx-2 opacity-40">·</span>
        {built.layers.reduce((sum, layer) => sum + layer.instances.length, 0)} shapes
      </div>
    </div>
  );
}

function gradientMarkup(id: string, appearance: Appearance): string {
  const colors = appearance.palette.length ? appearance.palette : ["#111111", "#ffffff"];
  const stops = colors
    .map((color, index) => {
      const offset = colors.length === 1 ? 0 : (index / (colors.length - 1)) * 100;
      const opacity = appearance.softEdge && index === colors.length - 1 ? 0 : 1;
      return `<stop offset="${offset}%" stop-color="${color}" stop-opacity="${opacity}"/>`;
    })
    .join("");
  const rad = (appearance.gradientAngle * Math.PI) / 180;
  const dots = `<pattern id="dots-${id}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="0.9" fill="#081018" fill-opacity="0.45"/></pattern>`;
  const local =
    appearance.gradientKind === "radial"
      ? `<radialGradient id="local-${id}" cx="35%" cy="30%" r="75%">${stops}</radialGradient>`
      : `<linearGradient id="local-${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  const global =
    appearance.gradientKind === "radial"
      ? `<radialGradient id="global-${id}" gradientUnits="userSpaceOnUse" cx="50%" cy="45%" r="60%">${stops}</radialGradient>`
      : `<linearGradient id="global-${id}" gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="${50 + Math.cos(rad) * 50}%" y2="${50 + Math.sin(rad) * 50}%">${stops}</linearGradient>`;
  return local + global + dots;
}
