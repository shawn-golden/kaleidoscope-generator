import { create } from "zustand";
import { fieldsFor, MOTION_PRESETS, sceneFromPreset, createInitialScene, type Preset } from "./engine/presets";
import { randomSeed } from "./engine/prng";
import { clampParam } from "./engine/params";
import type { GeneratorId, Layer, Motion, Params, Scene, ShapeId } from "./engine/types";

export type Mode = "design" | "animate" | "interact";

type Studio = {
  scene: Scene;
  activeLayerId: string;
  mode: Mode;
  inspectorOpen: boolean;
  galleryOpen: boolean;
  galleryCount: 4 | 9 | 16;
  reducedMotion: boolean;
  live: boolean;
  notice: string;
  view: { x: number; y: number; zoom: number };
  setNotice: (notice: string) => void;
  setMode: (mode: Mode) => void;
  setInspector: (open: boolean) => void;
  setGallery: (open: boolean, count?: 4 | 9 | 16) => void;
  setReduced: (value: boolean) => void;
  setLive: (value: boolean) => void;
  setView: (view: { x: number; y: number; zoom: number }) => void;
  setScene: (scene: Scene) => void;
  patchScene: (partial: Partial<Scene>) => void;
  patchLayer: (partial: Partial<Layer>) => void;
  setParam: (key: string, value: number | string | boolean) => void;
  toggleLock: (key: string) => void;
  setGenerator: (id: GeneratorId) => void;
  setShape: (shape: ShapeId) => void;
  setSvg: (markup: string) => void;
  loadPreset: (preset: Preset) => void;
  applyMotion: (id: string) => void;
  generate: () => void;
  setSeed: (seed: string) => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string) => void;
};

function active(scene: Scene, id: string): Layer {
  return scene.layers.find((layer) => layer.id === id) ?? scene.layers[0]!;
}

function replaceLayer(scene: Scene, id: string, next: Layer): Scene {
  return { ...scene, layers: scene.layers.map((layer) => (layer.id === id ? next : layer)) };
}

export const useStudio = create<Studio>((set, get) => ({
  scene: createInitialScene(),
  activeLayerId: "layer-1",
  mode: "design",
  inspectorOpen: true,
  galleryOpen: false,
  galleryCount: 4,
  reducedMotion: false,
  live: false,
  notice: "",
  view: { x: 40, y: 40, zoom: 0.7 },
  setNotice: (notice) => set({ notice }),
  setMode: (mode) => {
    const scene = get().scene;
    if (mode === "animate" && !get().reducedMotion) {
      set({ mode, scene: { ...scene, motion: { ...scene.motion, playing: true } } });
      return;
    }
    if (mode === "interact") {
      set({
        mode,
        scene: {
          ...scene,
          interaction: { ...scene.interaction, enabled: true },
          motion: { ...scene.motion, playing: get().reducedMotion ? scene.motion.playing : true },
        },
      });
      return;
    }
    set({ mode });
  },
  setInspector: (inspectorOpen) => set({ inspectorOpen }),
  setGallery: (galleryOpen, count) => set({ galleryOpen, galleryCount: count ?? get().galleryCount }),
  setReduced: (reducedMotion) => {
    const scene = get().scene;
    set({
      reducedMotion,
      scene: reducedMotion ? { ...scene, motion: { ...scene.motion, playing: false } } : scene,
    });
  },
  setLive: (live) => set({ live }),
  setView: (view) => set({ view }),
  setScene: (scene) => set({ scene, activeLayerId: scene.layers[0]?.id ?? "layer-1" }),
  patchScene: (partial) => set({ scene: { ...get().scene, ...partial } }),
  patchLayer: (partial) => {
    const { scene, activeLayerId } = get();
    const layer = { ...active(scene, activeLayerId), ...partial };
    set({ scene: replaceLayer(scene, layer.id, layer) });
  },
  setParam: (key, value) => {
    const { scene, activeLayerId } = get();
    const layer = active(scene, activeLayerId);
    const field = fieldsFor(layer.generatorId).find((item) => item.key === key);
    const next = field ? clampParam(field, value) : value;
    set({
      scene: replaceLayer(scene, layer.id, { ...layer, params: { ...layer.params, [key]: next } }),
    });
  },
  toggleLock: (key) => {
    const locks = new Set(get().scene.locks);
    if (locks.has(key)) locks.delete(key);
    else locks.add(key);
    set({ scene: { ...get().scene, locks: [...locks] } });
  },
  setGenerator: (id) => {
    const { scene, activeLayerId } = get();
    const layer = active(scene, activeLayerId);
    set({
      scene: replaceLayer(scene, layer.id, {
        ...layer,
        generatorId: id,
        params: Object.fromEntries(fieldsFor(id).map((field) => [field.key, field.default])),
      }),
    });
  },
  setShape: (shape) => {
    const { scene, activeLayerId } = get();
    const layer = active(scene, activeLayerId);
    set({ scene: replaceLayer(scene, layer.id, { ...layer, source: { ...layer.source, kind: "shape", shape } }) });
  },
  setSvg: (markup) => {
    const { scene, activeLayerId } = get();
    const layer = active(scene, activeLayerId);
    set({
      scene: replaceLayer(scene, layer.id, {
        ...layer,
        source: { ...layer.source, kind: markup ? "svg" : "shape", svgMarkup: markup },
      }),
    });
  },
  loadPreset: (preset) => {
    const scene = sceneFromPreset(preset);
    set({ scene, activeLayerId: scene.layers[0]!.id, notice: preset.name });
  },
  applyMotion: (id) => {
    const preset = MOTION_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const scene = get().scene;
    const motion: Motion = { ...scene.motion, ...preset.motion };
    if (get().reducedMotion) motion.playing = false;
    set({ scene: { ...scene, motion } });
  },
  generate: () => {
    const { scene, activeLayerId } = get();
    const layer = active(scene, activeLayerId);
    const locks = new Set(scene.locks);
    const seed = locks.has("seed") ? scene.seed : randomSeed();
    const params: Params = { ...layer.params };
    for (const field of fieldsFor(layer.generatorId)) {
      if (locks.has(`param:${field.key}`)) continue;
      if (field.kind === "boolean") {
        if (Math.random() < 0.5) params[field.key] = !params[field.key];
      } else if (field.kind === "select" && field.options?.length) {
        params[field.key] = field.options[Math.floor(Math.random() * field.options.length)]!.value;
      } else if (field.kind === "number" || field.kind === "int") {
        const min = field.min ?? 0;
        const max = field.max ?? 1;
        const current = Number(params[field.key] ?? field.default);
        let value = Math.min(max, Math.max(min, current + (Math.random() * 2 - 1) * (max - min) * 0.35));
        if (field.kind === "int") value = Math.round(value);
        params[field.key] = value;
      }
    }
    set({
      scene: replaceLayer({ ...scene, seed }, layer.id, { ...layer, params }),
      notice: `Seed ${seed}`,
    });
  },
  setSeed: (seed) => set({ scene: { ...get().scene, seed: seed.trim() || get().scene.seed } }),
  addLayer: () => {
    const { scene, activeLayerId } = get();
    if (scene.layers.length >= 3) return;
    const current = active(scene, activeLayerId);
    const id = `layer-${Math.random().toString(36).slice(2, 7)}`;
    const layer: Layer = {
      ...current,
      id,
      name: `Layer ${scene.layers.length + 1}`,
      opacity: 0.85,
      params: { ...current.params },
      modifiers: current.modifiers.map((mod) => ({ ...mod, params: { ...mod.params } })),
      appearance: { ...current.appearance, palette: [...current.appearance.palette] },
      source: { ...current.source },
    };
    set({ scene: { ...scene, layers: [...scene.layers, layer] }, activeLayerId: id });
  },
  removeLayer: (id) => {
    const scene = get().scene;
    if (scene.layers.length === 1) return;
    const layers = scene.layers.filter((layer) => layer.id !== id);
    set({ scene: { ...scene, layers }, activeLayerId: layers[0]!.id });
  },
  selectLayer: (activeLayerId) => set({ activeLayerId }),
}));