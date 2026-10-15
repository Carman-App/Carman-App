import { expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
export const PASSWORD = "Safari2026x";
export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.test`;
export const uniquePhone = () => `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

export async function register(page: Page, role: "BUYER" | "BROKER" | "DEALER", name: string) {
  const email = unique(role.toLowerCase());
  await page.goto(`/register?role=${role}`);
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#phone").fill(uniquePhone());
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/register/);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
