import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const shots = [
  ["Radial kaleidoscope", "Hex jewel", "hex"],
  ["Radial kaleidoscope", "Broken fan", "broken"],
  ["Pixel mosaic", "Green bilateral", "mosaic"],
  ["Pixel mosaic", "Pink field", "pink"],
  ["Polar grid", "Double checker", "checker"],
  ["Polar grid", "Doppler", "doppler"],
  ["Modular tiling", "Arc weave", "arcs"],
  ["Modular tiling", "Interlock", "interlock"],
  ["Modular tiling", "Dissolving checker", "dissolve"],
  ["Modular tiling", "Petal tiles", "petals"],
  ["Modular tiling", "Lane maze", "lanes"],
  ["Scattered geometry", "Symbol field", "symbols"],
  ["Scattered geometry", "Sparse rosette", "rosette"],
  ["Scattered geometry", "Gradient rings", "rings"],
  ["Scattered geometry", "Mirror bands", "bands"],
  ["Wallpaper group", "Square mirrors", "p4m"],
  ["Recursive nest", "Nested poster", "nested"],
  ["Frieze", "Frieze jump", "frieze"],
];

await mkdir("/tmp/shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.goto("http://127.0.0.1:4173");
await page.waitForSelector("[data-testid=artboard] path");
for (const [engine, preset, file] of shots) {
  await page.getByRole("button", { name: engine, exact: true }).click();
  await page.getByRole("button", { name: preset, exact: true }).click();
  await page.waitForTimeout(250);
  const count = await page.locator("[data-testid=artboard] path").count();
  console.log(file, count);
  await page.screenshot({ path: `/tmp/shots/${file}.png` });
}
await page.screenshot({ path: "/tmp/shots/ui.png", fullPage: false });
console.log("errors", errors);
await browser.close();
