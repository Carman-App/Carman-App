"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Review } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { relativeTime } from "@/lib/utils";

export function Stars({ value, size = 4 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-border"} style={{ width: size * 4, height: size * 4 }} aria-hidden />
      ))}
    </span>
  );
}

export function Reviews({ kind, slug }: { kind: "brokers" | "dealers"; slug: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reviews = useQuery({ queryKey: ["reviews", kind, slug], queryFn: () => apiPaged<Review[]>(`/${kind}/${slug}/reviews?limit=20`) });
  const eligibility = useQuery({ queryKey: ["can-review", kind, slug, user?.id], queryFn: () => api<{ canReview: boolean; alreadyReviewed: boolean }>(`/${kind}/${slug}/can-review`), enabled: !!user });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api(`/${kind}/${slug}/reviews`, { method: "POST", body: { rating, comment } });
      toast.success("Thanks for your review");
      setComment("");
      qc.invalidateQueries({ queryKey: ["reviews", kind, slug] });
      qc.invalidateQueries({ queryKey: ["can-review", kind, slug] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reviews" className="space-y-4">
      <h2 id="reviews" className="text-lg font-bold">Reviews</h2>
      {eligibility.data?.canReview && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-semibold">How was your experience?</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} stars`} onClick={() => setRating(i)}>
                <Star className={i <= rating ? "size-6 fill-amber-400 text-amber-400" : "size-6 text-border"} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Was the car as described? Did they respond quickly?" />
          <Button onClick={submit} loading={busy} size="sm">Post review</Button>
        </div>
      )}
      {reviews.data?.data.length ? (
        <ul className="space-y-3">
          {reviews.data.data.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <span className="text-xs text-ink-subtle">{relativeTime(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              <p className="mt-1 text-xs text-ink-muted">— {r.buyer.name}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{reviews.isLoading ? "Loading reviews…" : "No reviews yet. Buyers can review after contacting this seller through Showrooms."}</p>
      )}
    </section>
  );
}
