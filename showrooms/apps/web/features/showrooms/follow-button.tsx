"use client";

import { UserPlus, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export function FollowButton({ kind, slug }: { kind: "brokers" | "dealers"; slug: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ isFollowing?: boolean }>(`/${kind}/${slug}`).then((p) => setFollowing(!!p.isFollowing)).catch(() => undefined);
  }, [user, kind, slug]);

  async function toggle() {
    if (!user) return router.push(`/login?next=/${kind}/${slug}`);
    setBusy(true);
    try {
      await api(`/${kind}/${slug}/follow`, { method: following ? "DELETE" : "POST" });
      setFollowing(!following);
      if (!following) toast.success("Following", { description: "You'll be notified when they list a new car." });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={following ? "outline" : "secondary"} onClick={toggle} loading={busy}>
      {following ? <UserCheck /> : <UserPlus />} {following ? "Following" : "Follow"}
    </Button>
  );
}
