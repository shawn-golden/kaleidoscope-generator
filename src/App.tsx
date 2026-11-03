import { useEffect, useMemo, useState, type ReactNode } from "react";
import { pathD } from "./engine/geom";
import { modifierFields } from "./engine/modifiers";
import { fieldsFor, ENGINE_BLURBS, ENGINE_LABELS, MOTION_PRESETS, PRESETS } from "./engine/presets";
import { buildScene } from "./engine/pipeline";
import { SHAPE_LABELS, shapeMotif } from "./engine/shapes";
import { sanitizeSvg } from "./engine/svgImport";
import { SHAPE_IDS, type GeneratorId, type InteractionPreset, type ModifierInstance, type ShapeId } from "./engine/types";
import { canRecordVideo, downloadBlob, downloadText, interactiveHtml, posedDocument, svgToPngBlob, zipStore } from "./render/document";
import { runtime } from "./render/runtime";
import { useStudio } from "./store";
import { Fields } from "./ui/Fields";
import { Stage } from "./ui/Stage";

const ENGINES = Object.keys(ENGINE_LABELS) as GeneratorId[];
const INTERACTIONS: { id: InteractionPreset; name: string }[] = [
  { id: "ripple", name: "Ripple" },
  { id: "magnet", name: "Magnet" },
  { id: "repulsion", name: "Repulsion" },
  { id: "lens", name: "Lens" },
  { id: "swirl", name: "Swirl" },
  { id: "color", name: "Color" },
];

export function App() {
  const scene = useStudio((s) => s.scene);
  const activeLayerId = useStudio((s) => s.activeLayerId);
  const mode = useStudio((s) => s.mode);
  const inspectorOpen = useStudio((s) => s.inspectorOpen);
  const galleryOpen = useStudio((s) => s.galleryOpen);
  const galleryCount = useStudio((s) => s.galleryCount);
  const reduced = useStudio((s) => s.reducedMotion);
  const live = useStudio((s) => s.live);
  const notice = useStudio((s) => s.notice);
  const setMode = useStudio((s) => s.setMode);
  const setInspector = useStudio((s) => s.setInspector);
  const setGallery = useStudio((s) => s.setGallery);
  const setReduced = useStudio((s) => s.setReduced);
  const setLive = useStudio((s) => s.setLive);
  const setNotice = useStudio((s) => s.setNotice);
  const patchScene = useStudio((s) => s.patchScene);
  const patchLayer = useStudio((s) => s.patchLayer);
  const setGenerator = useStudio((s) => s.setGenerator);
  const setShape = useStudio((s) => s.setShape);
  const setSvg = useStudio((s) => s.setSvg);
  const loadPreset = useStudio((s) => s.loadPreset);
  const applyMotion = useStudio((s) => s.applyMotion);
  const generate = useStudio((s) => s.generate);
  const setSeed = useStudio((s) => s.setSeed);
  const toggleLock = useStudio((s) => s.toggleLock);
  const addLayer = useStudio((s) => s.addLayer);
  const removeLayer = useStudio((s) => s.removeLayer);
  const selectLayer = useStudio((s) => s.selectLayer);
  const setView = useStudio((s) => s.setView);
  const [seedDraft, setSeedDraft] = useState(scene.seed);
  const layer = scene.layers.find((item) => item.id === activeLayerId) ?? scene.layers[0]!;

  useEffect(() => setSeedDraft(scene.seed), [scene.seed]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) setReduced(true);
  }, [setReduced]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 1600);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (event.code === "Space") runtime.space = true;
      if (event.key === "Escape") setLive(false);
      if (typing) return;
      if (event.key === "g") generate();
      if (event.key === "f") {
        const svg = document.querySelector("[data-testid=artboard]") as SVGSVGElement | null;
        if (!svg) return;
        const zoom = Math.min((svg.clientWidth - 64) / scene.width, (svg.clientHeight - 64) / scene.height);
        setView({ zoom, x: (svg.clientWidth - scene.width * zoom) / 2, y: (svg.clientHeight - scene.height * zoom) / 2 });
      }
      if (event.key === " ") {
        event.preventDefault();
        patchScene({ motion: { ...scene.motion, playing: !scene.motion.playing } });
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") runtime.space = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", up);
    };
  }, [generate, patchScene, scene.height, scene.motion, scene.width, setLive, setView]);

  const variations = useMemo(() => {
    if (!galleryOpen) return [];
    return Array.from({ length: galleryCount }, (_, index) => {
      const seed = `${scene.seed}-${index + 1}`;
      const built = buildScene({ ...scene, seed });
      return { seed, count: built.layers.reduce((sum, item) => sum + item.instances.length, 0), scene: { ...scene, seed } };
    });
  }, [galleryOpen, galleryCount, scene]);

  const exportSvg = () => {
    const doc = posedDocument(scene, runtime.time, runtime.pointer, runtime.ripples, reduced);
    downloadText(`${slug(scene.name)}.svg`, doc.svg, "image/svg+xml");
  };
  const exportPng = async () => {
    const doc = posedDocument(scene, runtime.time, runtime.pointer, runtime.ripples, reduced);
    const png = await svgToPngBlob(doc.svg, scene.width, scene.height);
    downloadBlob(`${slug(scene.name)}.png`, png);
    setNotice("PNG is a raster snapshot");
  };
  const exportJson = () => downloadText(`${slug(scene.name)}.json`, JSON.stringify(scene, null, 2), "application/json");
  const exportHtml = () => {
    const built = buildScene(scene);
    downloadText(`${slug(scene.name)}.html`, interactiveHtml(scene, built.layers), "text/html");
  };
  const exportVideo = async () => {
    const frames = 36;
    const fps = 12;
    if (canRecordVideo()) {
      const canvas = document.createElement("canvas");
      canvas.width = scene.width;
      canvas.height = scene.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const stream = canvas.captureStream(fps);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      for (let i = 0; i < frames; i++) {
        const doc = posedDocument({ ...scene, motion: { ...scene.motion, playing: true } }, i / fps, null, [], reduced);
        const png = await svgToPngBlob(doc.svg, scene.width, scene.height, 1);
        const bitmap = await createImageBitmap(png);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        await wait(1000 / fps);
      }
      recorder.stop();
      await stopped;
      downloadBlob(`${slug(scene.name)}.webm`, new Blob(chunks, { type: "video/webm" }));
      setNotice("WebM recording");
      return;
    }
    const files = [];
    for (let i = 0; i < 8; i++) {
      const doc = posedDocument(scene, i / 8, null, [], reduced);
      const png = await svgToPngBlob(doc.svg, scene.width, scene.height, 1);
      files.push({ name: `frame-${String(i).padStart(2, "0")}.png`, data: new Uint8Array(await png.arrayBuffer()) });
    }
    downloadBlob(`${slug(scene.name)}-frames.zip`, zipStore(files));
    setNotice("Frame sequence");
  };

  return (
    <div className={`relative flex h-full flex-col ${live ? "live" : ""}`}>
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
        <div className="mr-2 leading-none">
          <div className="font-serif text-[22px] tracking-tight">Kaleidoscope</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Studio</div>
        </div>
        <div className="flex rounded-full bg-[#efeae2] p-0.5">
          {(["design", "animate", "interact"] as const).map((item) => (
            <button
              key={item}
              className={`rounded-full px-3 py-1 text-sm capitalize ${mode === item ? "bg-ink text-paper" : "text-muted"}`}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="ml-2 flex items-center gap-1 text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Seed</span>
          <input
            aria-label="Seed"
            className="w-28 rounded-md border border-line bg-white px-2 py-1 font-mono text-xs"
            value={seedDraft}
            onChange={(event) => setSeedDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSeed(seedDraft);
            }}
            onBlur={() => setSeed(seedDraft)}
          />
          <button className="text-xs text-muted" onClick={() => toggleLock("seed")}>
            {scene.locks.includes("seed") ? "Locked" : "Lock"}
          </button>
          <button
            className="text-xs text-accent"
            onClick={() => {
              navigator.clipboard?.writeText(scene.seed);
              setNotice("Seed copied");
            }}
          >
            Copy
          </button>
        </label>
        <button className="rounded-full bg-accent px-3 py-1.5 text-sm text-white" onClick={generate}>
          Generate
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button className="rounded-md border border-line px-2 py-1" onClick={exportSvg}>
            SVG
          </button>
          <button className="rounded-md border border-line px-2 py-1" title="PNG is a raster snapshot, not an editable SVG" onClick={() => void exportPng()}>
            PNG
          </button>
          <button className="rounded-md border border-line px-2 py-1" onClick={exportJson}>
            JSON
          </button>
          <button className="rounded-md border border-line px-2 py-1" onClick={() => document.getElementById("json-import")?.click()}>
            Open
          </button>
          <button className="rounded-md border border-line px-2 py-1" onClick={exportHtml}>
            HTML
          </button>
          <button className="rounded-md border border-line px-2 py-1" onClick={() => void exportVideo()}>
            {canRecordVideo() ? "Video" : "Frames"}
          </button>
          <button
            className="rounded-md border border-line px-2 py-1"
            onClick={() => {
              const svg = document.querySelector("[data-testid=artboard]") as SVGSVGElement | null;
              const node = svg?.parentElement;
              if (!node) return;
              setLive(true);
              node.requestFullscreen?.().catch(() => undefined);
            }}
          >
            Live
          </button>
        </div>
      </header>
      <div className={`grid min-h-0 flex-1 ${inspectorOpen ? "grid-cols-[300px_minmax(0,1fr)_320px]" : "grid-cols-[300px_minmax(0,1fr)]"}`}>
        <aside className="min-h-0 overflow-auto border-r border-line bg-panel p-4">
          <Section title="Source">
            <div className="grid grid-cols-4 gap-1.5">
              {SHAPE_IDS.map((shape) => (
                <button
                  key={shape}
                  title={SHAPE_LABELS[shape]}
                  aria-label={SHAPE_LABELS[shape]}
                  className={`rounded-md border p-1 ${layer.source.kind === "shape" && layer.source.shape === shape ? "border-accent bg-white" : "border-transparent bg-[#efeae2]"}`}
                  onClick={() => setShape(shape)}
                >
                  <ShapeIcon shape={shape} />
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-muted">
              Import SVG
              <input
                className="mt-1 block w-full text-xs"
                type="file"
                accept="image/svg+xml,.svg"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const clean = sanitizeSvg(await file.text());
                  if (!clean.motif.contours.length) {
                    setNotice("That SVG had no drawable geometry");
                    return;
                  }
                  setSvg(clean.markup);
                  setNotice("SVG imported");
                }}
              />
            </label>
          </Section>
          <Section title="Construction">
            <div className="grid grid-cols-2 gap-1.5">
              {ENGINES.map((id) => (
                <button
                  key={id}
                  className={`rounded-md border px-2 py-1.5 text-left text-xs ${layer.generatorId === id ? "border-ink bg-ink text-paper" : "border-line bg-white"}`}
                  onClick={() => setGenerator(id)}
                >
                  {ENGINE_LABELS[id]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{ENGINE_BLURBS[layer.generatorId]}</p>
            <div className="mt-3">
              <Fields fields={fieldsFor(layer.generatorId)} />
            </div>
          </Section>
          <Section title="Presets">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.filter((preset) => preset.engine === layer.generatorId).map((preset) => (
                <button key={preset.id} title={preset.blurb} className="rounded-full border border-line bg-white px-2 py-1 text-xs" onClick={() => loadPreset(preset)}>
                  {preset.name}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Variations">
            <div className="mb-2 flex gap-1">
              {[4, 9, 16].map((count) => (
                <button key={count} className={`rounded-md px-2 py-1 text-xs ${galleryCount === count && galleryOpen ? "bg-ink text-paper" : "bg-[#efeae2]"}`} onClick={() => setGallery(true, count as 4 | 9 | 16)}>
                  {count}
                </button>
              ))}
              <button className="ml-auto text-xs text-muted" onClick={() => setGallery(!galleryOpen)}>
                {galleryOpen ? "Hide" : "Show"}
              </button>
            </div>
            {galleryOpen ? (
              <div className={`grid gap-2 ${galleryCount === 16 ? "grid-cols-4" : galleryCount === 9 ? "grid-cols-3" : "grid-cols-2"}`}>
                {variations.map((item) => (
                  <button key={item.seed} className="overflow-hidden rounded-md border border-line bg-white" onClick={() => setSeed(item.seed)} title={item.seed}>
                    <VariationThumb scene={item.scene} />
                  </button>
                ))}
              </div>
            ) : null}
          </Section>
        </aside>
        <main className="min-h-0">
          <Stage />
        </main>
        {inspectorOpen ? (
          <aside className="min-h-0 overflow-auto border-l border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted">Inspector</h2>
              <button className="text-xs text-muted" onClick={() => setInspector(false)}>
                Collapse
              </button>
            </div>
            <Section title="Artboard">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Width" value={scene.width} onChange={(width) => patchScene({ width: Math.max(200, width) })} />
                <NumberField label="Height" value={scene.height} onChange={(height) => patchScene({ height: Math.max(200, height) })} />
              </div>
              <label className="mt-2 flex items-center justify-between text-xs">
                Background
                <input type="color" value={toColor(scene.background)} onChange={(event) => patchScene({ background: event.target.value })} />
              </label>
              <div className="mt-2 flex gap-1">
                {[
                  ["Square", 1000, 1000],
                  ["Poster", 900, 1200],
                  ["Story", 800, 1400],
                ].map(([name, w, h]) => (
                  <button key={String(name)} className="rounded-md bg-[#efeae2] px-2 py-1 text-xs" onClick={() => patchScene({ width: Number(w), height: Number(h) })}>
                    {name}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Layers">
              {scene.layers.map((item) => (
                <button key={item.id} className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs ${item.id === layer.id ? "bg-ink text-paper" : "bg-[#efeae2]"}`} onClick={() => selectLayer(item.id)}>
                  <span>{item.name}</span>
                  <span>{item.generatorId}</span>
                </button>
              ))}
              <div className="mt-2 flex gap-2 text-xs">
                <button onClick={addLayer}>Add</button>
                <button onClick={() => removeLayer(layer.id)}>Remove</button>
                <button onClick={() => patchLayer({ visible: !layer.visible })}>{layer.visible ? "Hide" : "Show"}</button>
              </div>
              <label className="mt-2 block text-xs">
                Opacity
                <input type="range" min={0.1} max={1} step={0.01} value={layer.opacity} onChange={(event) => patchLayer({ opacity: Number(event.target.value) })} />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <select aria-label="Blend" className="rounded-md border border-line bg-white px-1 py-1" value={layer.blend} onChange={(event) => patchLayer({ blend: event.target.value as typeof layer.blend })}>
                  {["normal", "multiply", "screen", "overlay", "difference", "darken"].map((blend) => (
                    <option key={blend}>{blend}</option>
                  ))}
                </select>
                <select aria-label="Clip" className="rounded-md border border-line bg-white px-1 py-1" value={layer.clip} onChange={(event) => patchLayer({ clip: event.target.value as typeof layer.clip })}>
                  <option value="none">No clip</option>
                  <option value="circle">Circle</option>
                  <option value="round">Round rect</option>
                </select>
              </div>
            </Section>
            <Section title="Appearance">
              <div className="flex flex-wrap gap-1">
                {layer.appearance.palette.map((color, index) => (
                  <input
                    key={`${color}-${index}`}
                    aria-label={`Palette ${index + 1}`}
                    type="color"
                    value={toColor(color)}
                    onChange={(event) => {
                      const palette = [...layer.appearance.palette];
                      palette[index] = event.target.value;
                      patchLayer({ appearance: { ...layer.appearance, palette } });
                    }}
                  />
                ))}
                <button
                  className="text-xs"
                  onClick={() => patchLayer({ appearance: { ...layer.appearance, palette: [...layer.appearance.palette, "#888888"].slice(0, 8) } })}
                >
                  Add
                </button>
              </div>
              <SelectRow
                label="Color"
                value={layer.appearance.colorMode}
                options={["index", "ring", "checker", "angle", "seed"]}
                onChange={(colorMode) => patchLayer({ appearance: { ...layer.appearance, colorMode: colorMode as typeof layer.appearance.colorMode } })}
              />
              <SelectRow
                label="Fill"
                value={layer.appearance.fillStyle}
                options={["solid", "local", "global"]}
                onChange={(fillStyle) => patchLayer({ appearance: { ...layer.appearance, fillStyle: fillStyle as typeof layer.appearance.fillStyle } })}
              />
              <SelectRow
                label="Gradient"
                value={layer.appearance.gradientKind}
                options={["linear", "radial"]}
                onChange={(gradientKind) => patchLayer({ appearance: { ...layer.appearance, gradientKind: gradientKind as typeof layer.appearance.gradientKind } })}
              />
              <SelectRow
                label="Texture"
                value={layer.appearance.texture}
                options={["none", "dots"]}
                onChange={(texture) => patchLayer({ appearance: { ...layer.appearance, texture: texture as typeof layer.appearance.texture } })}
              />
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={layer.appearance.softEdge} onChange={(event) => patchLayer({ appearance: { ...layer.appearance, softEdge: event.target.checked } })} />
                Soft edge
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={layer.appearance.strokeEnabled} onChange={(event) => patchLayer({ appearance: { ...layer.appearance, strokeEnabled: event.target.checked } })} />
                Stroke
                <input type="color" value={toColor(layer.appearance.stroke)} onChange={(event) => patchLayer({ appearance: { ...layer.appearance, stroke: event.target.value } })} />
              </label>
            </Section>
            <Section title="Modifiers">
              {layer.modifiers.map((mod) => (
                <div key={mod.id} className="mb-3 rounded-md border border-line p-2">
                  <label className="flex items-center justify-between text-xs capitalize">
                    {mod.id}
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      onChange={(event) =>
                        patchLayer({
                          modifiers: layer.modifiers.map((item) => (item.id === mod.id ? { ...item, enabled: event.target.checked } : item)),
                        })
                      }
                    />
                  </label>
                  {mod.enabled ? (
                    <div className="mt-2 space-y-2">
                      {modifierFields[mod.id]?.map((field) => (
                        <label key={field.key} className="block text-[11px] text-muted">
                          {field.label}
                          {field.kind === "select" ? (
                            <select
                              className="mt-1 w-full rounded border border-line bg-white px-1 py-1 text-ink"
                              value={String(mod.params[field.key] ?? field.default)}
                              onChange={(event) => updateMod(layer.modifiers, mod.id, field.key, event.target.value, patchLayer)}
                            >
                              {field.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="mt-1 w-full"
                              type="range"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              value={Number(mod.params[field.key] ?? field.default)}
                              onChange={(event) => updateMod(layer.modifiers, mod.id, field.key, Number(event.target.value), patchLayer)}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </Section>
            <Section title="Motion">
              <div className="mb-2 flex flex-wrap gap-1">
                {MOTION_PRESETS.map((preset) => (
                  <button key={preset.id} className="rounded-full bg-[#efeae2] px-2 py-1 text-xs" onClick={() => applyMotion(preset.id)}>
                    {preset.name}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={scene.motion.playing && !reduced}
                  onChange={(event) => patchScene({ motion: { ...scene.motion, playing: event.target.checked } })}
                />
                Play
              </label>
              <Slider label="Speed" min={0.1} max={3} step={0.05} value={scene.motion.speed} onChange={(speed) => patchScene({ motion: { ...scene.motion, speed } })} />
              <Slider label="Rotation" min={-90} max={90} step={1} value={scene.motion.rotation} onChange={(rotation) => patchScene({ motion: { ...scene.motion, rotation } })} />
              <Slider label="Pulse" min={0} max={0.4} step={0.01} value={scene.motion.pulse} onChange={(pulse) => patchScene({ motion: { ...scene.motion, pulse } })} />
              <Slider label="Wave" min={0} max={40} step={0.5} value={scene.motion.waveAmp} onChange={(waveAmp) => patchScene({ motion: { ...scene.motion, waveAmp } })} />
              <SelectRow
                label="Phase"
                value={scene.motion.phase}
                options={["uniform", "byRadius", "byIndex"]}
                onChange={(phase) => patchScene({ motion: { ...scene.motion, phase: phase as typeof scene.motion.phase } })}
              />
            </Section>
            <Section title="Interaction">
              <div className="mb-2 flex flex-wrap gap-1">
                {INTERACTIONS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`rounded-full px-2 py-1 text-xs ${scene.interaction.preset === preset.id ? "bg-ink text-paper" : "bg-[#efeae2]"}`}
                    onClick={() => {
                      setMode("interact");
                      patchScene({ interaction: { ...scene.interaction, preset: preset.id, enabled: true } });
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <Slider label="Radius" min={40} max={700} step={1} value={scene.interaction.radius} onChange={(radius) => patchScene({ interaction: { ...scene.interaction, radius } })} />
              <Slider label="Strength" min={0} max={1.5} step={0.01} value={scene.interaction.strength} onChange={(strength) => patchScene({ interaction: { ...scene.interaction, strength } })} />
              <Slider label="Amplitude" min={0} max={80} step={1} value={scene.interaction.amplitude} onChange={(amplitude) => patchScene({ interaction: { ...scene.interaction, amplitude } })} />
              <Slider label="Wavelength" min={12} max={240} step={1} value={scene.interaction.wavelength} onChange={(wavelength) => patchScene({ interaction: { ...scene.interaction, wavelength } })} />
              <Slider label="Width" min={10} max={240} step={1} value={scene.interaction.width} onChange={(width) => patchScene({ interaction: { ...scene.interaction, width } })} />
              <Slider label="Decay" min={0.3} max={4} step={0.05} value={scene.interaction.decay} onChange={(decay) => patchScene({ interaction: { ...scene.interaction, decay } })} />
              <label className="mt-1 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={scene.interaction.displaceInstances} onChange={(event) => patchScene({ interaction: { ...scene.interaction, displaceInstances: event.target.checked } })} />
                Move instances
              </label>
              <label className="mt-1 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={scene.interaction.deformGeometry} onChange={(event) => patchScene({ interaction: { ...scene.interaction, deformGeometry: event.target.checked } })} />
                Deform geometry
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />
                Reduced motion
              </label>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">PNG and video frames are raster. SVG and HTML keep vectors. Ripples are sampled from the resting geometry every frame.</p>
            </Section>
          </aside>
        ) : (
          <button className="absolute right-3 top-16 rounded-full border border-line bg-panel px-3 py-1 text-xs" onClick={() => setInspector(true)}>
            Inspector
          </button>
        )}
      </div>
      {notice ? <div className="pointer-events-none fixed bottom-4 right-4 rounded-full bg-ink px-3 py-1.5 text-sm text-paper">{notice}</div> : null}
      <input
        className="hidden"
        type="file"
        id="json-import"
        accept="application/json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            if (data.version !== 1 || !Array.isArray(data.layers)) throw new Error("bad");
            useStudio.getState().setScene(data);
            setNotice("Scene loaded");
          } catch {
            setNotice("Could not read that scene");
          }
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1 text-ink" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="mt-2 block text-[11px] text-muted">
      <span className="flex justify-between">
        {label}
        <span>{Math.round(value * 100) / 100}</span>
      </span>
      <input className="w-full accent-accent" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="mt-2 flex items-center justify-between gap-2 text-xs">
      {label}
      <select aria-label={label} className="rounded-md border border-line bg-white px-1 py-1" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ShapeIcon({ shape }: { shape: ShapeId }) {
  const motif = shapeMotif(shape);
  return (
    <svg viewBox="-0.7 -0.7 1.4 1.4" className="h-8 w-full">
      <path d={pathD(motif.contours)} fill="currentColor" fillRule={motif.evenodd ? "evenodd" : "nonzero"} />
    </svg>
  );
}

function VariationThumb({ scene }: { scene: ReturnType<typeof useStudio.getState>["scene"] }) {
  const built = useMemo(() => buildScene(scene), [scene]);
  const layer = built.layers[0];
  if (!layer) return null;
  return (
    <svg viewBox={`0 0 ${scene.width} ${scene.height}`} className="aspect-square w-full">
      <rect width={scene.width} height={scene.height} fill={scene.background} />
      {layer.instances.slice(0, 700).map((inst) => (
        <path key={inst.id} d={pathD(inst.contours)} fill={layer.layer.appearance.palette[Math.abs(inst.colorIndex) % layer.layer.appearance.palette.length] || "#111"} fillRule={inst.evenodd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

function updateMod(modifiers: ModifierInstance[], id: string, key: string, value: number | string, patchLayer: (partial: { modifiers: ModifierInstance[] }) => void) {
  patchLayer({
    modifiers: modifiers.map((mod) => (mod.id === id ? { ...mod, params: { ...mod.params, [key]: value } } : mod)),
  });
}

function toColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#111111";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "kaleidoscope";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
