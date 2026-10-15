import { expect, test } from "@playwright/test";
import { API, login, register } from "./helpers";

test.describe("buyer", () => {
  test("registers, searches, saves a car, contacts on WhatsApp and requests a viewing", async ({ page }) => {
    await register(page, "BUYER", "Wanjiku Kamau");

    // Search from the homepage form.
    await page.goto("/");
    await page.getByRole("combobox", { name: "Make" }).selectOption("Toyota");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/make=Toyota/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Toyota");

    const first = page.locator("article h3 a").first();
    const title = (await first.textContent())!.trim();
    await first.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByRole("complementary", { name: "Buyer safety" })).toContainText("Always inspect and verify a vehicle before making payment.");

    // WhatsApp opens a prefilled chat; nothing is sent automatically.
    const wa = page.getByRole("link", { name: /WhatsApp seller/ }).first();
    const href = await wa.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/2547\d{8}\?text=/);
    expect(decodeURIComponent(href!)).toContain(title);

    // Save it.
    const save = page.getByRole("complementary").getByRole("button", { name: "Save vehicle" });
    await save.click();
    await expect(page.getByRole("complementary").getByRole("button", { name: "Remove from saved" })).toBeVisible();
    await page.goto("/dashboard/saved");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    // Request a viewing.
    await page.getByRole("link", { name: title }).click();
    await page.getByRole("button", { name: "Request viewing" }).first().click();
    await page.getByLabel("Message (optional)").fill("Can I see it on Saturday morning?");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Viewing requested")).toBeVisible();
  });
});

test.describe("seller and admin", () => {
  test("broker lists a car with photos, admin approves, it goes public, broker shares to WhatsApp", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Full listing flow runs once, on desktop");
    const model = `Zeta${Date.now() % 1000000}`;
    await register(page, "BROKER", `E2E Motors ${Date.now() % 10000}`);
    await expect(page).toHaveURL(/dashboard\/profile/);

    await page.goto("/dashboard/vehicles/new");
    await page.getByLabel("Make").selectOption("Toyota");
    await page.getByLabel("Model").fill(model);
    await page.getByLabel("Year").fill("2018");
    await page.getByRole("button", { name: "Continue to photos" }).click();
    await expect(page).toHaveURL(/dashboard\/vehicles\/[a-f0-9]{24}/);

    // Photos: real upload through signature → direct upload → confirm.
    await page.locator('input[type="file"][multiple]').setInputFiles(["e2e/fixtures/car.png", "e2e/fixtures/car.png"]);
    await expect(page.getByText("Cover")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('ul[aria-label="Photos"] li')).toHaveCount(2, { timeout: 20_000 });
    await page.getByRole("button", { name: /Continue/ }).click();

    await page.getByLabel("Mileage (km)").fill("64000");
    await page.getByLabel("Engine capacity (cc)").fill("1800");
    await page.getByLabel("Colour").fill("Pearl white");
    await page.getByLabel("Transmission").selectOption("AUTOMATIC");
    await page.getByLabel("Fuel type").selectOption("PETROL");
    await page.getByLabel("Body type").selectOption("SEDAN");
    await page.getByLabel("Drive").selectOption("FWD");
    await page.getByLabel("Condition").selectOption("FOREIGN_USED");
    await page.getByRole("button", { name: /Continue/ }).click();

    await page.getByLabel("Price (KES)").fill("2150000");
    await page.getByLabel("Town").selectOption("Nairobi");
    await page.getByLabel("Area (optional)").fill("Kilimani");
    await page.getByRole("button", { name: /Continue/ }).click();

    await page.getByLabel("Description").fill("Very clean Premio, accident free, full Toyota service history, new tyres.");
    await page.getByRole("button", { name: "Reverse camera" }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("button", { name: "Submit listing" }).click();
    await expect(page.getByText("Submitted for review")).toBeVisible();

    // Not public while pending.
    const search = await page.request.get(`${API}/vehicles?q=${encodeURIComponent(model)}`);
    expect((await search.json()).meta.total).toBe(0);

    // Admin approves in a separate session.
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await login(admin, "admin@showrooms.test", "Showroom2026");
    await admin.goto("/admin/vehicles/pending");
    await admin.getByRole("cell", { name: `2018 Toyota ${model}` }).click();
    await admin.getByRole("button", { name: "Approve" }).click();
    await expect(admin.getByText("Approved")).toBeVisible();
    await adminCtx.close();

    // Public now.
    const anon = await browser.newContext();
    const visitor = await anon.newPage();
    await visitor.goto(`/vehicles?q=${encodeURIComponent(model)}`);
    await expect(visitor.getByRole("link", { name: `2018 Toyota ${model}` })).toBeVisible();
    await anon.close();

    // Broker shares it.
    await page.goto("/dashboard/vehicles");
    await page.getByRole("button", { name: "Share" }).first().click();
    const share = page.getByRole("link", { name: "Share to WhatsApp" });
    await expect(share).toBeVisible();
    const text = decodeURIComponent((await share.getAttribute("href"))!.replace("https://wa.me/?text=", ""));
    expect(text).toContain(`2018 Toyota ${model}`);
    expect(text).toContain("KES 2,150,000");
    expect(text).toContain("/vehicles/");
  });

  test("non-admins are kept out of the admin dashboard", async ({ page }) => {
    await register(page, "BROKER", "Not An Admin");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
    const res = await page.request.get(`${API}/admin/overview`);
    expect(res.status()).toBe(401);
  });
});
