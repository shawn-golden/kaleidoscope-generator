import { friezeFields } from "./generators/frieze";
import { kaleidoscopeFields } from "./generators/kaleidoscope";
import { modularFields } from "./generators/modular";
import { mosaicFields } from "./generators/mosaic";
import { polarFields } from "./generators/polar";
import { recursiveFields } from "./generators/recursive";
import { scatterFields } from "./generators/scatter";
import { wallpaperFields } from "./generators/wallpaper";
import { defaultModifiers } from "./modifiers";
import { defaults } from "./params";
import { baseScene, defaultAppearance, makeLayer, withShape } from "./scene";
import type { Appearance, GeneratorId, ModifierId, Motion, ParamField, Params, Scene, ShapeId } from "./types";

export type Preset = {
  id: string;
  name: string;
  engine: GeneratorId;
  blurb: string;
  seed: string;
  width: number;
  height: number;
  background: string;
  shape: ShapeId;
  params: Params;
  appearance: Partial<Appearance>;
  modifiers?: { id: ModifierId; params?: Params }[];
};

const FIELDS: Record<GeneratorId, ParamField[]> = {
  kaleidoscope: kaleidoscopeFields,
  mosaic: mosaicFields,
  polar: polarFields,
  modular: modularFields,
  scatter: scatterFields,
  wallpaper: wallpaperFields,
  recursive: recursiveFields,
  frieze: friezeFields,
};

export function fieldsFor(engine: GeneratorId): ParamField[] {
  return FIELDS[engine];
}

function paramsFor(engine: GeneratorId, overrides: Params): Params {
  return { ...defaults(FIELDS[engine]), ...overrides };
}

export function sceneFromPreset(preset: Preset): Scene {
  const mods = defaultModifiers().map((mod) => {
    const hit = preset.modifiers?.find((m) => m.id === mod.id);
    if (!hit) return mod;
    return { ...mod, enabled: true, params: { ...mod.params, ...hit.params } };
  });
  const layer = makeLayer({
    id: "layer-1",
    name: preset.name,
    generatorId: preset.engine,
    params: paramsFor(preset.engine, preset.params),
    source: withShape(preset.shape),
    modifiers: mods,
    appearance: defaultAppearance(preset.appearance.palette ?? ["#1b1714"], preset.appearance),
  });
  return baseScene({
    name: preset.name,
    seed: preset.seed,
    width: preset.width,
    height: preset.height,
    background: preset.background,
    layers: [layer],
  });
}

const P = {
  kaleido: ["#111111", "#1d4e89", "#e23d3d", "#f2d23a", "#f08ac4", "#ffffff", "#e07a3d"],
  green: ["#e7a23a", "#d9d3c7", "#f7f7f4", "#6b3a2a", "#f2a3c0", "#14315c"],
  pink: ["#f4b6cf", "#3db87a", "#3d6fd8", "#f0a03a", "#6b3a2a"],
  navy: ["#f2b23a", "#c9c4dc", "#f7f4ee", "#1a6b66", "#c8ddd4", "#f3a0c0"],
  poster: ["#111111", "#f4f1ea"],
  gold: ["#d7c48a"],
  circles: ["#1f6feb", "#14d3c8", "#123c2e", "#ffe14a", "#7a5cff"],
  petals: ["#ff2d3a", "#ff4fa3", "#3d7dff", "#141414", "#f4f1ea", "#2fbf71"],
  symbols: ["#2450ff", "#ff3b4e", "#ffe14a", "#ffffff"],
  lattice: ["#ff5a1f", "#0e3b36"],
  diagonal: ["#f26b2b", "#fff1ea"],
  dissolve: ["#3d4a28", "#f25a22"],
  variety: ["#e23b4a", "#ff8aa0", "#ffd5dc", "#4a1020"],
  bands: ["#1f8a4c", "#e56ab8", "#f7f7f4", "#123c2a"],
  mind: ["#123e38", "#d7f5a8", "#8fd96a", "#061f1c"],
};

export const PRESETS: Preset[] = [
  { id: "hex-jewel", name: "Hex jewel", engine: "kaleidoscope", blurb: "Six mirrors, stacked rings", seed: "hexjewel", width: 1000, height: 1000, background: "#f7f4ee", shape: "star", params: { sectors: 6, reflect: true, rings: 5, copies: 2, offset: 0, break: 0.04, scale: 0.78, inner: 0.06 }, appearance: { palette: P.kaleido, colorMode: "ring" } },
  { id: "octagon-bloom", name: "Octagon bloom", engine: "kaleidoscope", blurb: "Eight-fold circles", seed: "octbloom", width: 1000, height: 1000, background: "#10243f", shape: "circle", params: { sectors: 8, reflect: true, rings: 6, copies: 1, scale: 0.92, break: 0, inner: 0.1 }, appearance: { palette: ["#7ec8ff", "#ffffff", "#f2d23a", "#ff7ab8"], colorMode: "ring", fillStyle: "local", gradientKind: "radial", softEdge: true } },
  { id: "broken-fan", name: "Broken fan", engine: "kaleidoscope", blurb: "Rotation only, symmetry let go", seed: "broken7", width: 1000, height: 1000, background: "#1b1714", shape: "triangle", params: { sectors: 7, reflect: false, rings: 6, copies: 2, break: 0.92, offset: 4, scale: 0.66 }, appearance: { palette: ["#f4f1ea", "#e23d4a", "#f2d23a"], colorMode: "index" } },
  { id: "spiral-offset", name: "Spiral offset", engine: "kaleidoscope", blurb: "Each ring twists", seed: "spiral", width: 1000, height: 1000, background: "#f6f3ee", shape: "rect", params: { sectors: 12, reflect: true, rings: 8, copies: 1, offset: 11, break: 0, scale: 0.7, inner: 0.05 }, appearance: { palette: ["#0f6e56", "#1b1714", "#e7f27a"], colorMode: "ring" } },
  { id: "crossfire", name: "Crossfire", engine: "kaleidoscope", blurb: "Four-fold crosses", seed: "crossfire", width: 1000, height: 1000, background: "#f7f4ee", shape: "cross", params: { sectors: 4, reflect: true, rings: 5, copies: 2, scale: 0.8, break: 0.02 }, appearance: { palette: P.poster, colorMode: "checker" } },
  { id: "fine-dust", name: "Fine dust", engine: "kaleidoscope", blurb: "Many small marks", seed: "finedust", width: 1000, height: 1000, background: "#fffaf6", shape: "asterisk", params: { sectors: 16, reflect: true, rings: 9, copies: 2, scale: 0.42, break: 0.2, offset: 3 }, appearance: { palette: ["#1b1714", "#e23d4a", "#0f6e56", "#2450ff"], colorMode: "seed" } },
  { id: "green-bilateral", name: "Green bilateral", engine: "mosaic", blurb: "Mirrored pixel field", seed: "greenmosaic", width: 900, height: 1100, background: "#1f7a4d", shape: "square", params: { cols: 36, rows: 44, symmetry: "bilateral", occupancy: 0.58, motif: "mixed", frame: 2, gap: 0.08, colors: 4 }, appearance: { palette: P.green, colorMode: "index" } },
  { id: "pink-field", name: "Pink field", engine: "mosaic", blurb: "Open cells, warm ground", seed: "pinkfield", width: 900, height: 1100, background: "#e7e0d8", shape: "rect", params: { cols: 28, rows: 36, symmetry: "bilateral", occupancy: 0.72, motif: "bar", frame: 1, gap: 0.16, colors: 4 }, appearance: { palette: P.pink, colorMode: "index" } },
  { id: "navy-portrait", name: "Navy portrait", engine: "mosaic", blurb: "Dark field, bright frame", seed: "navymosaic", width: 900, height: 1100, background: "#0c2c3a", shape: "square", params: { cols: 32, rows: 40, symmetry: "bilateral", occupancy: 0.64, motif: "mixed", frame: 3, gap: 0.06, colors: 4 }, appearance: { palette: P.navy, colorMode: "index" } },
  { id: "quadrant-blocks", name: "Quadrant blocks", engine: "mosaic", blurb: "Four mirrored blocks", seed: "quadblocks", width: 1000, height: 1000, background: "#f4f1ea", shape: "square", params: { cols: 32, rows: 32, symmetry: "quadrant", occupancy: 0.7, motif: "block", frame: 0, gap: 0.04, colors: 2 }, appearance: { palette: P.mind, colorMode: "index" } },
  { id: "rotational-cross", name: "Rotational cross", engine: "mosaic", blurb: "Four-fold plus marks", seed: "rotcross", width: 1000, height: 1000, background: "#f7f4ee", shape: "cross", params: { cols: 33, rows: 33, symmetry: "rot4", occupancy: 0.42, motif: "plus", frame: 0, gap: 0.1, colors: 1 }, appearance: { palette: P.poster, colorMode: "index" } },
  { id: "open-grid", name: "Open grid", engine: "mosaic", blurb: "Sparse half-turn", seed: "opengrid", width: 1000, height: 1000, background: "#f6f3ee", shape: "diamond", params: { cols: 24, rows: 24, symmetry: "rot2", occupancy: 0.28, motif: "cell", frame: 0, gap: 0.18, colors: 3 }, appearance: { palette: ["#0f6e56", "#e23d4a", "#1b1714"], colorMode: "index" } },
  { id: "double-checker", name: "Double checker", engine: "polar", blurb: "Two radial checkerboards", seed: "girona", width: 860, height: 1200, background: "#0e3a32", shape: "square", params: { centers: 2, layout: "vertical", rings: 12, countMode: "auto", twist: 7, pad: 0.07, checker: true, inner: 0.16, sweep: 1, draw: "sectors" }, appearance: { palette: ["#f0a3ad"], colorMode: "index" } },
  { id: "doppler", name: "Doppler", engine: "polar", blurb: "Checker bent by a wave", seed: "doppler", width: 900, height: 1200, background: "#0e5f86", shape: "square", params: { centers: 1, layout: "single", rings: 18, countMode: "auto", twist: 2, pad: 0.04, checker: true, inner: 0.04, draw: "sectors" }, appearance: { palette: P.gold, colorMode: "index" }, modifiers: [{ id: "wave", params: { axis: "x", amplitude: 14, wavelength: 90, phase: 0.6 } }] },
  { id: "single-bloom", name: "Single bloom", engine: "polar", blurb: "Rings of color", seed: "bloom", width: 1000, height: 1000, background: "#f7f4ee", shape: "circle", params: { centers: 1, rings: 10, countMode: "stepped", baseCount: 10, countStep: 4, checker: false, twist: 0, pad: 0.12, inner: 0.08, draw: "sectors" }, appearance: { palette: P.kaleido, colorMode: "ring" } },
  { id: "triple-orbit", name: "Triple orbit", engine: "polar", blurb: "Three centers", seed: "triple", width: 1000, height: 1000, background: "#1b1714", shape: "diamond", params: { centers: 3, layout: "ring", rings: 8, countMode: "auto", checker: true, twist: 5, pad: 0.1, inner: 0.1, draw: "sectors" }, appearance: { palette: ["#f2d23a", "#e23d4a", "#7ec8ff"], colorMode: "index" } },
  { id: "tight-spiral", name: "Tight spiral", engine: "polar", blurb: "Strong twist", seed: "tight", width: 1000, height: 1000, background: "#f6f3ee", shape: "square", params: { centers: 1, rings: 16, countMode: "auto", twist: 16, checker: true, pad: 0.05, inner: 0.04, draw: "sectors" }, appearance: { palette: ["#0f6e56", "#1b1714"], colorMode: "checker" } },
  { id: "crescent-sweep", name: "Crescent sweep", engine: "polar", blurb: "Partial rings", seed: "crescent", width: 1000, height: 1000, background: "#10243f", shape: "arc", params: { centers: 1, rings: 14, countMode: "stepped", baseCount: 20, countStep: 0, sweep: 0.62, checker: false, twist: 2, pad: 0.08, draw: "shapes" }, appearance: { palette: ["#f4f1ea", "#f2d23a", "#7ec8ff"], colorMode: "ring" } },
  { id: "arc-weave", name: "Arc weave", engine: "modular", blurb: "Classic truchet arcs", seed: "truchet", width: 1000, height: 1000, background: "#f7f4ee", shape: "quarter", params: { cols: 12, rows: 12, tile: "arcs", weight: 0.16, consistent: false, sourceScale: 0 }, appearance: { palette: ["#1b1714", "#0f6e56"], colorMode: "checker" } },
  { id: "interlock", name: "Interlock", engine: "modular", blurb: "Squares and diamonds", seed: "lattice", width: 1000, height: 1000, background: "#9fd8e0", shape: "diamond", params: { cols: 12, rows: 12, tile: "lattice", split: 0.48, weight: 0.16, sourceScale: 0 }, appearance: { palette: P.lattice, colorMode: "index" } },
  { id: "diagonal-lattice", name: "Diagonal lattice", engine: "modular", blurb: "Diamonds drifting in", seed: "diagonal", width: 1000, height: 1000, background: "#f26b2b", shape: "diamond", params: { cols: 14, rows: 14, tile: "diagonal", dissolve: 0.55, split: 0.2, sourceScale: 0 }, appearance: { palette: P.diagonal, colorMode: "index" } },
  { id: "dissolving-checker", name: "Dissolving checker", engine: "modular", blurb: "Checker fading to open ground", seed: "dissolve", width: 1000, height: 1000, background: "#f25a22", shape: "square", params: { cols: 16, rows: 16, tile: "dissolve", dissolve: 0.62, sourceScale: 0 }, appearance: { palette: P.dissolve, colorMode: "checker" } },
  { id: "petal-tiles", name: "Petal tiles", engine: "modular", blurb: "Overlapping rounds", seed: "petals", width: 1000, height: 1000, background: "#ece7e1", shape: "circle", params: { cols: 4, rows: 4, tile: "petals", sourceScale: 0 }, appearance: { palette: P.petals, colorMode: "index", fillStyle: "local", gradientKind: "radial", softEdge: true } },
  { id: "lane-maze", name: "Lane maze", engine: "modular", blurb: "Edge-matched lanes", seed: "lanes", width: 1000, height: 1000, background: "#f6f3ee", shape: "line", params: { cols: 14, rows: 14, tile: "lanes", weight: 0.16, sourceScale: 0 }, appearance: { palette: ["#1b1714", "#e23d4a"], colorMode: "index" } },
  { id: "symbol-field", name: "Symbol field", engine: "scatter", blurb: "A crowd of marks", seed: "symbols", width: 1000, height: 1000, background: "#111111", shape: "cross", params: { structure: "grid", cols: 10, rows: 10, density: 1, variety: 6, scale: 0.72, links: true, hierarchy: false, symmetry: "none", jitter: 0 }, appearance: { palette: P.symbols, colorMode: "index" } },
  { id: "sparse-rosette", name: "Sparse rosette", engine: "scatter", blurb: "Four-fold clusters", seed: "rosette", width: 1000, height: 1000, background: "#f7f4ee", shape: "diamond", params: { structure: "rosette", scale: 1.1, variety: 6, symmetry: "none" }, appearance: { palette: ["#ff3b4e", "#ff8a1e", "#111111", "#ffe14a", "#2450ff"], colorMode: "ring" } },
  { id: "gradient-rings", name: "Gradient rings", engine: "scatter", blurb: "Circles on concentric orbits", seed: "orbits", width: 1000, height: 1000, background: "#f5b400", shape: "circle", params: { structure: "rings", rows: 3, density: 1, scale: 1.35, variety: 1, hierarchy: true, symmetry: "none" }, appearance: { palette: P.circles, colorMode: "index", fillStyle: "local", gradientKind: "radial", softEdge: true, opacity: 0.92, texture: "dots" } },
  { id: "cluster-orchard", name: "Cluster orchard", engine: "scatter", blurb: "Groups, not noise", seed: "orchard", width: 1000, height: 1000, background: "#f6f3ee", shape: "circle", params: { structure: "clusters", spacing: 180, clusters: 9, density: 0.9, scale: 0.55, variety: 4, hierarchy: true }, appearance: { palette: ["#0f6e56", "#e23d4a", "#f2d23a", "#1b1714"], colorMode: "index" } },
  { id: "jitter-grid", name: "Jitter grid", engine: "scatter", blurb: "A grid, nudged", seed: "jitter", width: 1000, height: 1000, background: "#10243f", shape: "square", params: { structure: "jitter", cols: 9, rows: 9, jitter: 0.45, density: 0.85, scale: 0.7, variety: 3, hierarchy: true }, appearance: { palette: ["#f4f1ea", "#f2d23a", "#e23d4a"], colorMode: "seed" } },
  { id: "mirror-bands", name: "Mirror bands", engine: "scatter", blurb: "Stripes pinched at the horizon", seed: "bands", width: 800, height: 1100, background: "#07140f", shape: "rect", params: { structure: "bands", cols: 18, scale: 0.72, variety: 4 }, appearance: { palette: P.bands, colorMode: "index", fillStyle: "local", gradientKind: "linear", gradientAngle: 90 }, modifiers: [{ id: "pinch", params: { amount: 0.72, width: 120 } }] },
  { id: "p4m-star", name: "Square mirrors", engine: "wallpaper", blurb: "p4m", seed: "p4m", width: 1000, height: 1000, background: "#f7f4ee", shape: "l", params: { group: "p4m", cols: 4, rows: 4, scale: 0.34, ax: 0.7, ay: 0.62 }, appearance: { palette: P.kaleido, colorMode: "index" } },
  { id: "p6m-hex", name: "Hex mirrors", engine: "wallpaper", blurb: "p6m", seed: "p6m", width: 1000, height: 1100, background: "#1b1714", shape: "triangle", params: { group: "p6m", cols: 5, rows: 6, scale: 0.34 }, appearance: { palette: ["#f2d23a", "#e23d4a", "#7ec8ff", "#ffffff"], colorMode: "index" } },
  { id: "p4g-pin", name: "Glide pinwheel", engine: "wallpaper", blurb: "p4g", seed: "p4g", width: 1000, height: 1000, background: "#f6f3ee", shape: "l", params: { group: "p4g", cols: 4, rows: 4, scale: 0.3, ax: 0.72, ay: 0.58 }, appearance: { palette: ["#0f6e56", "#1b1714", "#e23d4a"], colorMode: "checker" } },
  { id: "nested-poster", name: "Nested poster", engine: "recursive", blurb: "Frames inside frames", seed: "nested", width: 900, height: 1200, background: "#ffd5dc", shape: "arc", params: { depth: 4, frame: "rect", motif: "arc", inset: 0.07, flip: true, inner: "kaleidoscope" }, appearance: { palette: P.variety, colorMode: "ring" } },
  { id: "round-nest", name: "Round nest", engine: "recursive", blurb: "Concentric rings, polar core", seed: "roundnest", width: 1000, height: 1000, background: "#1b1714", shape: "chevron", params: { depth: 3, frame: "round", motif: "source", inset: 0.09, inner: "polar" }, appearance: { palette: ["#f4f1ea", "#f2d23a", "#e23d4a"], colorMode: "ring" } },
  { id: "frieze-jump", name: "Frieze jump", engine: "frieze", blurb: "Horizontal mirrors", seed: "frieze", width: 1200, height: 720, background: "#f7f4ee", shape: "chevron", params: { group: "p2mm", repeats: 6, bands: 3, scale: 0.62 }, appearance: { palette: ["#1b1714", "#e23d4a", "#0f6e56"], colorMode: "ring" } },
  { id: "frieze-glide", name: "Frieze glide", engine: "frieze", blurb: "Stepping reflection", seed: "glide", width: 1200, height: 640, background: "#10243f", shape: "l", params: { group: "p11g", repeats: 7, bands: 2, scale: 0.7 }, appearance: { palette: ["#f4f1ea", "#f2d23a"], colorMode: "index" } },
];

export function presetById(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]!;
}

export function createInitialScene(): Scene {
  return sceneFromPreset(presetById("hex-jewel"));
}

export const MOTION_PRESETS: { id: string; name: string; motion: Partial<Motion> }[] = [
  { id: "still", name: "Still", motion: { playing: false, rotation: 0, pulse: 0, waveAmp: 0 } },
  { id: "spin", name: "Slow spin", motion: { playing: true, rotation: 18, pulse: 0, waveAmp: 0, speed: 1, phase: "uniform" } },
  { id: "pulse", name: "Pulse", motion: { playing: true, rotation: 0, pulse: 0.14, pulseSpeed: 0.4, waveAmp: 0 } },
  { id: "drift", name: "Drift wave", motion: { playing: true, rotation: 0, pulse: 0, waveAmp: 12, wavelength: 80, waveSpeed: 48 } },
  { id: "orbit", name: "Orbit", motion: { playing: true, rotation: 24, phase: "byRadius", pulse: 0.05, pulseSpeed: 0.3, waveAmp: 0 } },
  { id: "breath", name: "Breath", motion: { playing: true, pulse: 0.2, pulseSpeed: 0.22, waveAmp: 5, wavelength: 120, waveSpeed: 24, rotation: 6 } },
];

export const ENGINE_LABELS: Record<GeneratorId, string> = {
  kaleidoscope: "Radial kaleidoscope",
  mosaic: "Pixel mosaic",
  polar: "Polar grid",
  modular: "Modular tiling",
  scatter: "Scattered geometry",
  wallpaper: "Wallpaper group",
  recursive: "Recursive nest",
  frieze: "Frieze",
};

export const ENGINE_BLURBS: Record<GeneratorId, string> = {
  kaleidoscope: "Sectors, mirrors, rings, and a controlled break in the symmetry.",
  mosaic: "Discrete cells and multi-cell motifs. Symmetry copies cells, not stamped drawings.",
  polar: "Per-ring counts, curved checkers, more than one center.",
  modular: "Tiles that know their edges, plus lattices and petals.",
  scatter: "Grid, jitter, poisson, clusters. Composition before noise.",
  wallpaper: "p1 through p6m.",
  recursive: "Frames and a smaller pattern inside.",
  frieze: "The seven frieze groups, repeated sideways.",
};
