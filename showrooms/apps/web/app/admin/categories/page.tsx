"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Category } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function CategoriesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<Category[]>("/admin/categories") });
  const [name, setName] = useState("");
  const [models, setModels] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editModels, setEditModels] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/categories", { method: "POST", body: { kind: "MAKE", name, models: models.split(",").map((m) => m.trim()).filter(Boolean) } });
      setName("");
      setModels("");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  async function patch(c: Category, body: Partial<Category>) {
    try {
      await api(`/admin/categories/${c.id}`, { method: "PATCH", body });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Makes & categories" description="Makes and models offered in listing forms and search filters." />
      <Card>
        <CardHeader><CardTitle>Add a make</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <Field label="Make" htmlFor="c-name"><Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Models (comma separated)" htmlFor="c-models"><Input id="c-models" value={models} onChange={(e) => setModels(e.target.value)} /></Field>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
      <AdminTable
        loading={q.isLoading}
        error={q.error}
        rows={q.data}
        columns={[
          { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
          { key: "kind", header: "Kind", cell: (c) => <Badge>{c.kind === "MAKE" ? "make" : "body type"}</Badge> },
          { key: "models", header: "Models", cell: (c) => (c.kind === "MAKE" ? <span className="text-xs text-ink-muted">{c.models.length} models</span> : "—") },
          { key: "flags", header: "Shown", cell: (c) => <span className="flex gap-1">{c.isActive ? <Badge tone="success">active</Badge> : <Badge tone="warning">hidden</Badge>}{c.isPopular && <Badge tone="accent">popular</Badge>}</span> },
          {
            key: "actions",
            header: "",
            cell: (c) => (
              <span className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => patch(c, { isActive: !c.isActive })}>{c.isActive ? "Hide" : "Show"}</Button>
                <Button size="sm" variant="outline" onClick={() => patch(c, { isPopular: !c.isPopular })}>{c.isPopular ? "Unpin" : "Popular"}</Button>
                {c.kind === "MAKE" && <Button size="sm" variant="ghost" onClick={() => (setEditing(c), setEditModels(c.models.join(", ")))}>Models</Button>}
              </span>
            ),
          },
        ]}
      />
      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.name} models</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={5} value={editModels} onChange={(e) => setEditModels(e.target.value)} aria-label="Models" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => patch(editing, { models: editModels.split(",").map((m) => m.trim()).filter(Boolean) }).then(() => setEditing(null))}>Save models</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
