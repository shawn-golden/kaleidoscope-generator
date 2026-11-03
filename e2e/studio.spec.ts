import { expect, test } from "@playwright/test";

test("studio renders, generates, and loads a preset", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Kaleidoscope", { exact: true })).toBeVisible();
  const board = page.getByTestId("artboard");
  await expect(board.locator("path").first()).toBeVisible();
  const seed = page.getByRole("textbox", { name: "Seed", exact: true });
  const before = await seed.inputValue();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(seed).not.toHaveValue(before);
  await page.getByRole("button", { name: "Polar grid" }).click();
  await page.getByRole("button", { name: "Double checker" }).click();
  await expect(seed).toHaveValue("girona");
  await expect(board.locator("path").first()).toBeVisible();
});
