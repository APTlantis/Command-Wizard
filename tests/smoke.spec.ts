import { expect, test } from "@playwright/test";

test("loads the builder and sample schema", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CommandWizard")).toBeVisible();
  await expect(page.getByRole("button", { name: "Builder" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "rsync", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Linux (WSL)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "CLI", exact: true })).toHaveCount(0);
  await expect(page.getByText("Not ready.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Needs Review", { exact: true })).toHaveCount(0);
  const parameters = await page.getByTestId("builder-parameters").boundingBox();
  const options = await page.getByRole("heading", { name: "Options", exact: true }).boundingBox();
  expect(parameters!.y + parameters!.height).toBeLessThan(options!.y);
});

test("shows import workbench", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Import Workbench")).toBeVisible();
  await expect(page.getByRole("button", { name: "Parse Paste" })).toBeVisible();
  await expect(page.getByText("Command Preview", { exact: true })).toHaveCount(0);
});

test("category changes do not leave an unrelated command preview visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "rsync", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "PowerShell" }).click();
  await expect(page.getByText("Command Preview", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Linux (WSL)" }).click();
  await expect(page.getByText("Command Preview", { exact: true })).toBeVisible();
  for (const name of ["Schema", "Library", "Evidence"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText("Command Preview", { exact: true })).toHaveCount(0);
  }
});

test("imports cmdlets into PowerShell and spans an odd parameter row", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "rsync", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByPlaceholder("winget", { exact: true }).fill("Move-Item");
  await page.getByRole("textbox", { name: "Pasted Help Text" }).fill("Usage: Move-Item <source> <destination> <extra>");
  await page.getByRole("button", { name: "Parse Paste" }).click();
  await page.getByRole("button", { name: "Save Schema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Move-Item", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "PowerShell" })).toHaveAttribute("aria-selected", "true");
  const inputs = page.getByTestId("builder-parameters").locator("input");
  await expect(inputs).toHaveCount(3);
  const first = await inputs.nth(0).boundingBox();
  const second = await inputs.nth(1).boundingBox();
  const third = await inputs.nth(2).boundingBox();
  expect(first!.y).toBe(second!.y);
  expect(third!.y).toBeGreaterThan(first!.y);
  expect(third!.width).toBeGreaterThan(first!.width * 1.8);
  await page.screenshot({ path: `artifacts/verification/command-categories-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Schema", exact: true }).click();
  await page.getByLabel("Command Category", { exact: true }).selectOption("linux");
  await page.getByRole("button", { name: "Save Schema", exact: true }).click();
  await page.getByRole("button", { name: "Builder", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Linux (WSL)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Move-Item", level: 1 })).toBeVisible();
});
