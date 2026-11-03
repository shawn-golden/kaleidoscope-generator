# Kaleidoscope Studio

A browser studio for generative geometric patterns. The picture is built in layers: a source shape, a construction engine, geometric modifiers, appearance, then motion and pointer interaction. Animation always starts from the resting geometry.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL. `npm run build` writes a static bundle to `dist/`.

```bash
npm test
npm run test:e2e
```

End-to-end tests expect Playwright’s Chromium (`npx playwright install chromium`).

## Using it

The window is three columns: source and construction, the live canvas, and the inspector.

- **Design** edits the pattern. Drag the canvas to pan, scroll to zoom, press `F` to fit.
- **Animate** runs the shared clock: rotation, pulse, and a traveling wave. Press space to pause.
- **Interact** maps the pointer through the canvas transform. Ripple, magnet, repulsion, lens, swirl, and color are separate presets. Ripples are a traveling sine under a gaussian envelope that decays back to rest. Turn on instance movement, geometry deformation, or both.
- **Generate** rolls a new seed and nudges unlocked parameters. Lock a slider or the seed to keep it.
- **Variations** shows 4, 9, or 16 seeds of the current setup.

Presets cover the radial kaleidoscope, pixel mosaic, polar grid, modular tiles, and scattered compositions, plus wallpaper groups, nested frames, and friezes.

## Export

- **SVG** is the vector drawing.
- **PNG** is a raster snapshot of that drawing. It is not an editable SVG.
- **JSON** is the scene, and **Open** reads one back.
- **HTML** is a self-contained interactive page.
- **Video** records WebM when `MediaRecorder` and `captureStream` exist. Otherwise it downloads a zip of PNG frames.

Reduced motion follows the browser setting and the inspector toggle. While it is on, the clock stays still and traveling ripples stay off. Magnet, lens, swirl, and color still respond to the pointer.

## Architecture

`src/engine` is renderer-independent:

1. Source geometry — built-in shapes or a sanitized SVG.
2. Pattern construction — registered generators with parameter schemas.
3. Geometric modifiers — wave, density mask, pinch, jitter.
4. Appearance — palette, gradients, texture, stroke.
5. Motion and interaction — a clock and pointer fields, including ripples.

The UI panels are driven by those schemas. The canvas paints from a `requestAnimationFrame` loop and does not rerender React on every frame.
