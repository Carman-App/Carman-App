"use client";
import { AdminVehicles } from "@/features/admin/vehicle-moderation";
export default function Page() {
  return <AdminVehicles fixedStatus="PENDING_REVIEW" />;
}
