import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/features/inbox";
import { api } from "@/services/api";

export default function Notifications() {
  const qc = useQueryClient();
  return (
    <Screen edges={["bottom"]} className="gap-3 pt-3">
      <Button title="Mark all read" variant="ghost" size="sm" onPress={async () => { await api("/notifications/read-all", { method: "POST" }); qc.invalidateQueries({ queryKey: ["notifications"] }); }} />
      <NotificationList limit={50} />
    </Screen>
  );
}
