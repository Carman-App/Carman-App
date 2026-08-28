import "server-only";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * OPS-04 — deployment info that's genuinely readable from the repo, with no
 * fabricated pipeline behind it: package.json versions plus the current
 * checked-out git state. There is no real per-surface (owner app / mechanic
 * app / console / API) deploy pipeline in this codebase, and no deploy-time
 * or "previous version" history is recorded anywhere — this reads the
 * *current* working tree only, at request time (see `dynamic` on the page).
 */

const MONOREPO_ROOT = "C:\\Users\\walla\\Carman-App";

export type GitInfo = {
  commit: string | null;
  shortCommit: string | null;
  commitDate: string | null;
  available: boolean;
};

export type DeployInfo = {
  adminVersion: string | null;
  mobileVersion: string | null;
  git: GitInfo;
};

function readPackageVersion(pkgPath: string): string | null {
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function readGitInfo(): GitInfo {
  try {
    const commit = execSync("git rev-parse HEAD", { cwd: MONOREPO_ROOT, encoding: "utf-8" }).trim();
    const shortCommit = execSync("git rev-parse --short HEAD", { cwd: MONOREPO_ROOT, encoding: "utf-8" }).trim();
    const commitDate = execSync("git log -1 --format=%cI", { cwd: MONOREPO_ROOT, encoding: "utf-8" }).trim();
    return { commit, shortCommit, commitDate, available: true };
  } catch {
    // git not on PATH, not a repo, or the call otherwise failed — degrade to
    // "unavailable" rather than crashing the page.
    return { commit: null, shortCommit: null, commitDate: null, available: false };
  }
}

/** Reads current repo/version state at request time. Never throws. */
export function getDeployInfo(): DeployInfo {
  const adminVersion = readPackageVersion(path.join(MONOREPO_ROOT, "admin", "package.json"));
  const mobileVersion = readPackageVersion(path.join(MONOREPO_ROOT, "mobile", "package.json"));
  const git = readGitInfo();
  return { adminVersion, mobileVersion, git };
}
