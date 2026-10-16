import { expect, test } from "@playwright/test";

test("selects every supplied theme and retains the selection after reload", async ({ page }) => {
  await page.goto("/");
  const picker = page.getByLabel("App theme");
  for (const id of ["apt-ada", "apt-blackgold", "apt-clojure", "apt-crystal", "apt-factor", "apt-nim", "apt-swift", "blue-slate"]) {
    await picker.selectOption(id);
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    expect(await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--cw-canvas"))).toContain("oklch");
  }
  await picker.selectOption("apt-nim");
  await page.reload();
  await expect(picker).toHaveValue("apt-nim");
});

test("creates, edits, exports, imports and deletes a custom theme", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("button", { name: "Make a copy" }).click();
  await page.getByLabel("Theme name", { exact: true }).fill("My orchid");
  await page.getByLabel("Hue", { exact: true }).fill("310");
  await expect(page.getByTestId("theme-preview")).toContainText("My orchid");
  await page.getByRole("button", { name: "Save and apply" }).click();
  await expect(page.getByLabel("App theme")).toHaveValue(/custom-/);
  await page.reload();
  await expect(page.getByLabel("App theme").locator("option:checked")).toHaveText("My orchid");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.screenshot({ path: `artifacts/verification/themes-${testInfo.project.name}.png` });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export theme" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toMatch(/\.theme\.json$/);
  const before = await page.getByLabel("App theme").inputValue();
  await page.getByLabel("Theme file").setInputFiles((await downloaded.path())!);
  await expect(page.getByRole("button", { name: "Save and apply" })).toBeVisible();
  await page.getByRole("button", { name: "Save and apply" }).click();
  expect(await page.getByLabel("App theme").inputValue()).not.toBe(before);
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.getByLabel("App theme")).toHaveValue("blue-slate");
});

test("rejects malformed imports without replacing the selected theme", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByLabel("Theme file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(page.getByText(/Unsupported theme schemaVersion/)).toBeVisible();
  await expect(page.getByLabel("App theme")).toHaveValue("blue-slate");
});

test("protects drafts during navigation and failed storage writes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customize theme" }).click();
  await page.getByRole("button", { name: "Make a copy" }).click();
  await page.getByLabel("Theme name", { exact: true }).fill("Keep this draft");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Builder", exact: true }).click();
  await expect(page.getByLabel("Theme name", { exact: true })).toHaveValue("Keep this draft");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); }; });
  await page.getByRole("button", { name: "Save and apply" }).click();
  await expect(page.getByText(/Theme preferences were not saved/)).toBeVisible();
  await expect(page.getByLabel("Theme name", { exact: true })).toHaveValue("Keep this draft");
  await expect(page.getByLabel("App theme")).toHaveValue("blue-slate");
});

test("preserves corrupt storage until an explicit reset", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("commandwizard.themes.v1", "broken-data"));
  await page.reload();
  await page.getByRole("button", { name: "Customize theme" }).click();
  await expect(page.getByText(/Saved themes could not be read/)).toBeVisible();
  await page.getByLabel("App theme").selectOption("apt-ada");
  expect(await page.evaluate(() => localStorage.getItem("commandwizard.themes.v1"))).toBe("broken-data");
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Reset theme preferences" }).click();
  await expect(page.getByLabel("App theme")).toHaveValue("blue-slate");
});
