"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { PULSE_METRIC_KEYS, type PulseMetricKey } from "@/lib/pulse/metrics";

/** PULSE-06: which 5 metrics this admin has pinned to the top, persisted between sessions. */
export async function savePinnedMetrics(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const selected = formData.getAll("metric").map(String) as PulseMetricKey[];
  const valid = selected.filter((m) => (PULSE_METRIC_KEYS as readonly string[]).includes(m)).slice(0, 5);
  if (valid.length === 0) return;

  await prisma.adminPulsePreference.upsert({
    where: { adminUserId: admin.adminId },
    update: { metricKeys: valid },
    create: { adminUserId: admin.adminId, metricKeys: valid },
  });

  revalidatePath("/");
}
