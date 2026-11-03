import { defaultModifiers } from "./modifiers";
import type { Appearance, Interaction, Layer, Motion, Scene, ShapeId } from "./types";

export function defaultMotion(partial: Partial<Motion> = {}): Motion {
  return {
    playing: false,
    speed: 1,
    rotation: 0,
    pulse: 0,
    pulseSpeed: 0.45,
    waveAmp: 0,
    wavelength: 90,
    waveSpeed: 36,
    phase: "uniform",
    ...partial,
  };
}

export function defaultInteraction(partial: Partial<Interaction> = {}): Interaction {
  return {
    enabled: false,
    preset: "ripple",
    radius: 280,
    strength: 0.65,
    amplitude: 28,
    wavelength: 70,
    width: 90,
    decay: 1.15,
    rippleSpeed: 140,
    maxSources: 8,
    displaceInstances: true,
    deformGeometry: true,
    ...partial,
  };
}

export function defaultAppearance(palette: string[], partial: Partial<Appearance> = {}): Appearance {
  return {
    palette,
    colorMode: "index",
    fillStyle: "solid",
    gradientKind: "radial",
    gradientAngle: 90,
    softEdge: false,
    fillEnabled: true,
    strokeEnabled: false,
    stroke: "#1b1714",
    strokeWidth: 1.25,
    opacity: 1,
    texture: "none",
    ...partial,
  };
}

let layerSeq = 1;

export function makeLayer(partial: Partial<Layer> & { generatorId: Layer["generatorId"] }): Layer {
  return {
    id: partial.id ?? `layer-${layerSeq++}`,
    name: partial.name ?? "Layer",
    visible: partial.visible ?? true,
    opacity: partial.opacity ?? 1,
    blend: partial.blend ?? "normal",
    clip: partial.clip ?? "none",
    generatorId: partial.generatorId,
    params: partial.params ?? {},
    source: partial.source ?? { kind: "shape", shape: "star", svgMarkup: "" },
    modifiers: partial.modifiers ?? defaultModifiers(),
    appearance: partial.appearance ?? defaultAppearance(["#1b1714", "#0f6e56", "#e23d4a", "#f4f1ea"]),
  };
}

export function resetLayerIds() {
  layerSeq = 1;
}

export function withShape(shape: ShapeId): Layer["source"] {
  return { kind: "shape", shape, svgMarkup: "" };
}

export function baseScene(partial: Partial<Scene> & { layers: Layer[] }): Scene {
  return {
    version: 1,
    name: partial.name ?? "Untitled",
    seed: partial.seed ?? "kaleido",
    width: partial.width ?? 1000,
    height: partial.height ?? 1000,
    background: partial.background ?? "#f6f3ee",
    motion: partial.motion ?? defaultMotion(),
    interaction: partial.interaction ?? defaultInteraction(),
    layers: partial.layers,
    locks: partial.locks ?? [],
  };
}
