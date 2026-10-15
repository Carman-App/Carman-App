import { logger } from "../config/logger";
import { expireBoosts } from "../modules/boosts/boosts.service";
import { expirePromotions } from "../modules/boosts/promotion";
import { reconcileStalePayments } from "../modules/payments/payments.service";
import { expireSubscriptions } from "../modules/subscriptions/subscriptions.service";

/** Housekeeping that keeps entitlements and sort order correct over time. */
export async function runMaintenance(): Promise<Record<string, number>> {
  const results = {
    subscriptionsExpired: await expireSubscriptions(),
    boostsExpired: await expireBoosts(),
    promotionsExpired: await expirePromotions(),
    paymentsReconciled: await reconcileStalePayments(),
  };
  if (Object.values(results).some((n) => n > 0)) logger.info(results, "Maintenance run");
  return results;
}

/**
 * In-process scheduler. With several API instances, enable it on one only
 * (JOBS_ENABLED=false elsewhere); every job is idempotent, so an overlap is harmless.
 */
export function startJobs(intervalMs = 60_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runMaintenance();
    } catch (err) {
      logger.error({ err }, "Maintenance run failed");
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
