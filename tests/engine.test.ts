import { describe, expect, it } from "vitest";
import { placeMotif, signedArea } from "../src/engine/geom";
import { buildFrieze } from "../src/engine/generators/frieze";
import { buildKaleidoscope } from "../src/engine/generators/kaleidoscope";
import { solveLanes } from "../src/engine/generators/modular";
import { mosaicCells } from "../src/engine/generators/mosaic";
import { buildWallpaper } from "../src/engine/generators/wallpaper";
import { buildScene } from "../src/engine/pipeline";
import { poseInstances, rippleVector } from "../src/engine/pose";
import { createInitialScene, presetById, sceneFromPreset } from "../src/engine/presets";
import { hash32, rng } from "../src/engine/prng";
import { defaultInteraction, defaultMotion } from "../src/engine/scene";
import { shapeMotif } from "../src/engine/shapes";
import { sanitizeSvg } from "../src/engine/svgImport";
import { det, squareGroup } from "../src/engine/symmetry";
import type { Instance, PoseContext } from "../src/engine/types";

function angDist(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

describe("seeds", () => {
  it("reproduces a stream and a built pattern", () => {
    const a = rng("same", "main");
    const b = rng("same", "main");
    const seq = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seq);
    expect(rng("other", "main")()).not.toBe(seq[0]);
    expect(hash32("same")).toBe(hash32("same"));

    const motif = shapeMotif("star");
    const params = { sectors: 8, reflect: true, rings: 3, copies: 2, break: 0.2, offset: 5, scale: 0.6, inner: 0.1, spin: 10 };
    const left = buildKaleidoscope(params, motif, "repeat", 800, 800);
    const right = buildKaleidoscope(params, motif, "repeat", 800, 800);
    expect(left.map((i) => [i.x, i.y, i.colorIndex])).toEqual(right.map((i) => [i.x, i.y, i.colorIndex]));
    const other = buildKaleidoscope(params, motif, "different", 800, 800);
    expect(other.map((i) => i.x).join(",")).not.toBe(left.map((i) => i.x).join(","));

    const scene = createInitialScene();
    expect(buildScene(scene).layers[0]!.instances.map((i) => i.x)).toEqual(buildScene(scene).layers[0]!.instances.map((i) => i.x));
  });
});

describe("kaleidoscope mirrors", () => {
  it("pairs every sample with its reflection and keeps rotation chiral", () => {
    const motif = shapeMotif("l");
    const shared = { rings: 1, copies: 1, break: 0, offset: 0, scale: 0.5, inner: 0.25, spin: 0, sectors: 6 };
    const mirrored = buildKaleidoscope({ ...shared, reflect: true }, motif, "mirror", 800, 800);
    const rotated = buildKaleidoscope({ ...shared, reflect: false }, motif, "mirror", 800, 800);
    expect(mirrored.length).toBe(12);
    expect(rotated.length).toBe(6);
    for (const inst of mirrored) {
      const ang = Math.atan2(inst.y - 400, inst.x - 400);
      const rad = Math.hypot(inst.x - 400, inst.y - 400);
      const hit = mirrored.some((other) => {
        const a2 = Math.atan2(other.y - 400, other.x - 400);
        const r2 = Math.hypot(other.x - 400, other.y - 400);
        return Math.abs(r2 - rad) < 1.5 && angDist(a2, -ang) < 1e-6;
      });
      expect(hit).toBe(true);
    }
    const mirrorSigns = new Set(mirrored.map((i) => i.chirality));
    const rotateSigns = new Set(rotated.map((i) => i.chirality));
    expect([...mirrorSigns].sort()).toEqual([-1, 1]);
    expect(rotateSigns.size).toBe(1);
  });
});

describe("L shape", () => {
  it("rotation keeps chirality and reflection flips it", () => {
    const motif = shapeMotif("l");
    const base = signedArea(motif.contours[0]!.pts);
    const turned = placeMotif(motif, 0, 0, Math.PI / 2, 1, false);
    const flipped = placeMotif(motif, 0, 0, 0, 1, true);
    expect(Math.sign(base)).not.toBe(0);
    expect(Math.sign(signedArea(turned[0]!.pts))).toBe(Math.sign(base));
    expect(Math.sign(signedArea(flipped[0]!.pts))).toBe(-Math.sign(base));
  });
});

describe("mosaic", () => {
  it("mirrors bilateral occupancy and color", () => {
    const cells = mosaicCells(
      { cols: 16, rows: 10, symmetry: "bilateral", occupancy: 1, motif: "cell", frame: 0, gap: 0, colors: 3 },
      "mosaic",
      "square",
    );
    const map = new Map(cells.map((c) => [`${c.c},${c.r}`, c.color]));
    expect(cells.length).toBeGreaterThan(10);
    for (const cell of cells) expect(map.get(`${15 - cell.c},${cell.r}`)).toBe(cell.color);
  });
});

describe("wallpaper", () => {
  it("has the right orbit sizes and tiles a second cell", () => {
    expect(squareGroup("p1")).toHaveLength(1);
    expect(squareGroup("p2")).toHaveLength(2);
    expect(squareGroup("pm")).toHaveLength(2);
    expect(squareGroup("pmm")).toHaveLength(4);
    expect(squareGroup("p4")).toHaveLength(4);
    expect(squareGroup("p4m")).toHaveLength(8);
    expect(squareGroup("p4g")).toHaveLength(8);
    expect(squareGroup("p4").every((op) => det(op) > 0)).toBe(true);
    expect(squareGroup("p2").every((op) => det(op) > 0)).toBe(true);
    expect(squareGroup("pm").some((op) => det(op) < 0)).toBe(true);
    expect(squareGroup("pmm").some((op) => det(op) < 0)).toBe(true);
    expect(squareGroup("p4m").some((op) => det(op) < 0)).toBe(true);
    expect(squareGroup("p4g").some((op) => det(op) < 0)).toBe(true);

    const motif = shapeMotif("l");
    const tiled = buildWallpaper({ group: "pmm", cols: 2, rows: 1, scale: 0.3, spin: 0, ax: 0.7, ay: 0.62 }, motif, 400, 200);
    const left = tiled.filter((i) => i.x < 200);
    const right = tiled.filter((i) => i.x >= 200);
    expect(left).toHaveLength(4);
    expect(right).toHaveLength(4);
    for (const inst of left) {
      expect(right.some((other) => Math.abs(other.x - inst.x - 200) < 1 && Math.abs(other.y - inst.y) < 1)).toBe(true);
    }
    const signs = new Set(
      buildWallpaper({ group: "pmm", cols: 1, rows: 1, scale: 0.3, spin: 0, ax: 0.72, ay: 0.6 }, motif, 300, 300).map((i) => i.chirality),
    );
    expect(signs.has(1) && signs.has(-1)).toBe(true);
    const proper = new Set(
      buildWallpaper({ group: "p4", cols: 1, rows: 1, scale: 0.3, spin: 0, ax: 0.72, ay: 0.6 }, motif, 300, 300).map((i) => i.chirality),
    );
    expect(proper.size).toBe(1);
  });
});

describe("frieze", () => {
  it("hop stays chiral and jump reflects", () => {
    const motif = shapeMotif("l");
    const params = { repeats: 3, bands: 1, scale: 0.5, gap: 0.1 };
    const hop = buildFrieze({ ...params, group: "p111" }, motif, 600, 200);
    const jump = buildFrieze({ ...params, group: "p1m1" }, motif, 600, 200);
    expect(new Set(hop.map((i) => i.chirality)).size).toBe(1);
    expect(new Set(jump.map((i) => i.chirality)).size).toBe(2);
  });
});

describe("lanes", () => {
  it("matches sockets across edges", () => {
    const grid = solveLanes(9, 7, rng("edge", "lanes"));
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r]!.length; c++) {
        if (c > 0) expect(grid[r]![c]!.sockets[3]).toBe(grid[r]![c - 1]!.sockets[1]);
        if (r > 0) expect(grid[r]![c]!.sockets[0]).toBe(grid[r - 1]![c]!.sockets[2]);
      }
    }
  });
});

describe("ripples", () => {
  it("displaces, decays, and returns geometry to rest", () => {
    const interaction = defaultInteraction({
      enabled: true,
      preset: "ripple",
      amplitude: 30,
      wavelength: 40,
      width: 80,
      decay: 1.1,
      rippleSpeed: 20,
      displaceInstances: true,
      deformGeometry: true,
    });
    const sources = [
      { x: 0, y: 0, t0: 0, kind: "click" as const },
      { x: 40, y: 10, t0: 0, kind: "move" as const },
    ];
    expect(Math.hypot(rippleVector(10, 0, sources, 0, interaction).x, rippleVector(10, 0, sources, 0, interaction).y)).toBeGreaterThan(5);
    const late = rippleVector(10, 0, sources, 30, interaction);
    expect(Math.hypot(late.x, late.y)).toBeLessThan(1e-4);

    const motif = shapeMotif("square");
    const inst: Instance = {
      id: "sq",
      contours: motif.contours.map((ct) => ({
        closed: ct.closed,
        pts: ct.pts.map((p) => ({ x: p.x * 20 + 80, y: p.y * 20 + 60 })),
      })),
      x: 80,
      y: 60,
      colorIndex: 0,
      ring: 0,
      checker: 0,
      u: 0.4,
      v: 0.4,
      angle: 0,
      opacity: 1,
      chirality: 1,
    };
    const context = (time: number, ripples: PoseContext["ripples"]): PoseContext => ({
      time,
      seed: "ripple",
      motion: defaultMotion(),
      interaction,
      pointer: null,
      ripples,
      reducedMotion: false,
    });
    const rest = poseInstances([inst], context(0, []));
    const hit = poseInstances([inst], context(0, [{ x: 80, y: 60, t0: 0, kind: "click" }]));
    const back = poseInstances([inst], context(40, [{ x: 80, y: 60, t0: 0, kind: "click" }]));
    const origin = rest[0]!.contours[0]!.pts[0]!;
    const moved = hit[0]!.contours[0]!.pts[0]!;
    const recovered = back[0]!.contours[0]!.pts[0]!;
    expect(Math.hypot(moved.x - origin.x, moved.y - origin.y)).toBeGreaterThan(1);
    expect(Math.hypot(recovered.x - origin.x, recovered.y - origin.y)).toBeLessThan(1e-3);
  });
});

describe("svg import", () => {
  it("drops scripts and handlers", () => {
    const { markup, motif } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="12" height="8" onclick="alert(1)" fill="url(https://evil.test/x)"/></svg>`,
    );
    expect(markup.toLowerCase()).not.toContain("<script");
    expect(markup.toLowerCase()).not.toContain("onclick");
    expect(markup.toLowerCase()).not.toContain("evil.test");
    expect(motif.contours.length).toBe(1);
  });
});

describe("presets", () => {
  it("builds every curated preset", () => {
    for (const id of ["hex-jewel", "green-bilateral", "double-checker", "arc-weave", "symbol-field", "p4m-star", "nested-poster", "frieze-jump"]) {
      const built = buildScene(sceneFromPreset(presetById(id)));
      expect(built.layers[0]!.instances.length).toBeGreaterThan(4);
    }
  });
});
