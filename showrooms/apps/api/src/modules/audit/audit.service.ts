import type { Request } from "express";
import type { UserRole } from "@showrooms/shared";
import { logger } from "../../config/logger";
import { AuditLog } from "./audit-log.model";

export interface AuditEntry {
  action: string;
  actorId?: string;
  actorRole?: UserRole;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get("user-agent")?.slice(0, 300) };
}

/** Never lets an audit write failure break the action being audited. */
export async function audit(entry: AuditEntry, meta: RequestMeta = {}): Promise<void> {
  try {
    await AuditLog.create({ ...entry, ...meta });
  } catch (err) {
    logger.error({ err, action: entry.action }, "Failed to write audit log");
  }
}
