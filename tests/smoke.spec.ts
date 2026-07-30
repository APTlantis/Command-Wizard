import { expect, test } from "@playwright/test";

test("loads the builder and sample schema", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CommandWizard")).toBeVisible();
  await expect(page.getByRole("button", { name: "Builder" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "rsync", level: 1 })).toBeVisible();
});

test("shows import workbench", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Import Workbench")).toBeVisible();
  await expect(page.getByRole("button", { name: "Parse Paste" })).toBeVisible();
});
