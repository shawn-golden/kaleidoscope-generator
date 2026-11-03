import { buildFrieze } from "./generators/frieze";
import { buildKaleidoscope } from "./generators/kaleidoscope";
import { buildModular } from "./generators/modular";
import { buildMosaic } from "./generators/mosaic";
import { buildPolar } from "./generators/polar";
import { buildRecursive } from "./generators/recursive";
import { buildScatter } from "./generators/scatter";
import { buildWallpaper } from "./generators/wallpaper";
import { applyModifier } from "./modifiers";
import { sanitizeSvg } from "./svgImport";
import { shapeMotif } from "./shapes";
import type { Appearance, BuiltScene, GeneratorId, Instance, Layer, Motif, Scene } from "./types";

export function resolveMotif(layer: Layer): Motif {
  if (layer.source.kind === "svg" && layer.source.svgMarkup.trim()) {
    const parsed = sanitizeSvg(layer.source.svgMarkup);
    if (parsed.motif.contours.length) return parsed.motif;
  }
  return shapeMotif(layer.source.shape);
}

export function buildLayerInstances(layer: Layer, scene: Scene) {
  const motif = resolveMotif(layer);
  const { width, height, seed } = scene;
  let instances: Instance[] = [];
  switch (layer.generatorId as GeneratorId) {
    case "kaleidoscope":
      instances = buildKaleidoscope(layer.params, motif, seed, width, height, layer.id);
      break;
    case "mosaic":
      instances = buildMosaic(layer.params, seed, width, height, layer.source.shape, layer.id);
      break;
    case "polar":
      instances = buildPolar(layer.params, motif, width, height, layer.id);
      break;
    case "modular":
      instances = buildModular(layer.params, motif, seed, width, height, layer.id);
      break;
    case "scatter":
      instances = buildScatter(layer.params, motif, seed, width, height, layer.source.kind === "svg", layer.id);
      break;
    case "wallpaper":
      instances = buildWallpaper(layer.params, motif, width, height, layer.id);
      break;
    case "recursive":
      instances = buildRecursive(layer.params, motif, seed, width, height, layer.id);
      break;
    case "frieze":
      instances = buildFrieze(layer.params, motif, width, height, layer.id);
      break;
    default:
      instances = [];
  }
  for (const mod of layer.modifiers) {
    instances = applyModifier(mod, instances, seed, width, height);
  }
  return instances.map((inst) => ({ ...inst, colorIndex: bakeColor(inst, layer.appearance) }));
}

function bakeColor(inst: Instance, appearance: Appearance): number {
  const count = Math.max(1, appearance.palette.length);
  if (appearance.colorMode === "ring") return inst.ring;
  if (appearance.colorMode === "checker") return inst.checker;
  if (appearance.colorMode === "angle") {
    const tau = Math.PI * 2;
    const a = ((inst.angle % tau) + tau) % tau;
    return Math.floor((a / tau) * count);
  }
  return inst.colorIndex;
}

export function buildScene(scene: Scene): BuiltScene {
  return {
    scene,
    layers: scene.layers.map((layer) => ({
      layer,
      instances: layer.visible ? buildLayerInstances(layer, scene) : [],
    })),
  };
}
