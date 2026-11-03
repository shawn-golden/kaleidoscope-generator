export type Pt = { x: number; y: number };

export type Contour = {
  pts: Pt[];
  closed: boolean;
};

export type Motif = {
  contours: Contour[];
  evenodd?: boolean;
};

export type ShapeId =
  | "square"
  | "rect"
  | "circle"
  | "triangle"
  | "diamond"
  | "cross"
  | "asterisk"
  | "star"
  | "line"
  | "arc"
  | "quarter"
  | "semicircle"
  | "l"
  | "chevron"
  | "ring"
  | "compound";

export const SHAPE_IDS: ShapeId[] = [
  "square",
  "rect",
  "circle",
  "triangle",
  "diamond",
  "cross",
  "asterisk",
  "star",
  "line",
  "arc",
  "quarter",
  "semicircle",
  "l",
  "chevron",
  "ring",
  "compound",
];

export type GeneratorId =
  | "kaleidoscope"
  | "mosaic"
  | "polar"
  | "modular"
  | "scatter"
  | "wallpaper"
  | "recursive"
  | "frieze";

export type ParamKind = "number" | "int" | "boolean" | "select";

export type ParamField = {
  key: string;
  label: string;
  kind: ParamKind;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default: number | string | boolean;
  hint?: string;
};

export type Params = Record<string, number | string | boolean>;

export type Instance = {
  id: string;
  contours: Contour[];
  x: number;
  y: number;
  colorIndex: number;
  ring: number;
  checker: number;
  /** Normalized artboard position 0..1 */
  u: number;
  v: number;
  /** Polar angle of the pivot, radians */
  angle: number;
  opacity: number;
  evenodd?: boolean;
  /** Signed area of the first contour at rest, used to test chirality */
  chirality: number;
};

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "difference" | "darken";

export type Appearance = {
  palette: string[];
  colorMode: "index" | "ring" | "checker" | "angle" | "seed";
  fillStyle: "solid" | "local" | "global";
  gradientKind: "linear" | "radial";
  gradientAngle: number;
  softEdge: boolean;
  fillEnabled: boolean;
  strokeEnabled: boolean;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  texture: "none" | "dots";
};

export type ModifierId = "wave" | "mask" | "pinch" | "jitter";

export type ModifierInstance = {
  id: ModifierId;
  enabled: boolean;
  params: Params;
};

export type Source = {
  kind: "shape" | "svg";
  shape: ShapeId;
  /** Sanitized markup. Parsed at build time. */
  svgMarkup: string;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blend: BlendMode;
  clip: "none" | "circle" | "round";
  generatorId: GeneratorId;
  params: Params;
  source: Source;
  modifiers: ModifierInstance[];
  appearance: Appearance;
};

export type Motion = {
  playing: boolean;
  speed: number;
  rotation: number;
  pulse: number;
  pulseSpeed: number;
  waveAmp: number;
  wavelength: number;
  waveSpeed: number;
  phase: "uniform" | "byRadius" | "byIndex";
};

export type InteractionPreset = "ripple" | "magnet" | "repulsion" | "lens" | "swirl" | "color";

export type Interaction = {
  enabled: boolean;
  preset: InteractionPreset;
  radius: number;
  strength: number;
  amplitude: number;
  wavelength: number;
  width: number;
  decay: number;
  rippleSpeed: number;
  maxSources: number;
  displaceInstances: boolean;
  deformGeometry: boolean;
};

export type RippleSource = {
  x: number;
  y: number;
  t0: number;
  kind: "click" | "move";
};

export type Scene = {
  version: 1;
  name: string;
  seed: string;
  width: number;
  height: number;
  background: string;
  motion: Motion;
  interaction: Interaction;
  layers: Layer[];
  locks: string[];
};

export type BuiltLayer = {
  layer: Layer;
  instances: Instance[];
};

export type BuiltScene = {
  scene: Scene;
  layers: BuiltLayer[];
};

export type PoseContext = {
  time: number;
  seed: string;
  motion: Motion;
  interaction: Interaction;
  pointer: Pt | null;
  ripples: RippleSource[];
  reducedMotion: boolean;
};

export type PosedInstance = {
  id: string;
  contours: Contour[];
  colorIndex: number;
  opacity: number;
  evenodd?: boolean;
  u: number;
  v: number;
};
