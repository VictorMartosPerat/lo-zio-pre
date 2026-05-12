import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Users, Power, Trash2, Tag, Wand2 } from "lucide-react";

interface Discount {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string;
  usage_limit: number | null;
  is_active: boolean;
  created_at: string;
}

interface UserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  roles: string[];
}

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part(4)}-${part(4)}`;
};

const blankForm = (): Omit<Discount, "id" | "created_at"> => ({
  code: generateCode(),
  name: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  min_order_amount: null,
  expires_at: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 16),
  usage_limit: null,
  is_active: true,
});

const AdminDiscounts = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<Discount | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setDiscounts((data as Discount[]) || []);
    // redemption counts
    const ids = (data || []).map((d: Discount) => d.id);
    if (ids.length) {
      const { data: rd } = await supabase
        .from("discount_redemptions")
        .select("discount_id")
        .in("discount_id", ids)
        .is("cancelled_at", null);
      const c: Record<string, number> = {};
      (rd || []).forEach((r: { discount_id: string }) => {
        c[r.discount_id] = (c[r.discount_id] || 0) + 1;
      });
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (d: Discount) => {
    const { error } = await supabase
      .from("discounts")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success(d.is_active ? "Descuento desactivado" : "Descuento activado");
    load();
  };

  const hardDelete = async (d: Discount) => {
    if (!confirm(`¿Eliminar ${d.code}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("discounts").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Descuento eliminado");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6" /> Descuentos
        </h2>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo descuento
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Caduca</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && discounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aún no has creado ningún descuento.
                </TableCell>
              </TableRow>
            )}
            {discounts.map((d) => {
              const used = counts[d.id] || 0;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-bold">{d.code}</TableCell>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.discount_type === "percentage" ? "%" : "€ fijo"}</TableCell>
                  <TableCell>
                    {d.discount_type === "percentage"
                      ? `${d.discount_value}%`
                      : `${Number(d.discount_value).toFixed(2)} €`}
                  </TableCell>
                  <TableCell>
                    {d.min_order_amount != null ? `${Number(d.min_order_amount).toFixed(2)} €` : "—"}
                  </TableCell>
                  <TableCell>{new Date(d.expires_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {used}
                    {d.usage_limit != null ? ` / ${d.usage_limit}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>
                      {d.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setAssigning(d)} title="Asignaciones">
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(d)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleActive(d)}
                        title={d.is_active ? "Desactivar" : "Activar"}
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                      {used === 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => hardDelete(d)}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <DiscountFormDialog
          initial={editing ?? null}
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {assigning && (
        <AssignmentsDialog
          discount={assigning}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Form dialog
// ---------------------------------------------------------------------------

const DiscountFormDialog = ({
  initial,
  open,
  onClose,
  onSaved,
}: {
  initial: Discount | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        code: initial.code,
        name: initial.name,
        description: initial.description ?? "",
        discount_type: initial.discount_type,
        discount_value: initial.discount_value,
        min_order_amount: initial.min_order_amount,
        expires_at: initial.expires_at.slice(0, 16),
        usage_limit: initial.usage_limit,
        is_active: initial.is_active,
      };
    }
    return blankForm();
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: form.min_order_amount === null || form.min_order_amount === ("" as unknown)
        ? null
        : Number(form.min_order_amount),
      expires_at: new Date(form.expires_at).toISOString(),
      usage_limit: form.usage_limit === null || form.usage_limit === ("" as unknown)
        ? null
        : Number(form.usage_limit),
      is_active: form.is_active,
    };
    const { error } = initial
      ? await supabase.from("discounts").update(payload).eq("id", initial.id)
      : await supabase.from("discounts").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Descuento actualizado" : "Descuento creado");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar descuento" : "Nuevo descuento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Código</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: generateCode() })}>
                <Wand2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Nombre interno</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <Label>Descripción (mostrada al cliente)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <RadioGroup
              value={form.discount_type}
              onValueChange={(v) => setForm({ ...form, discount_type: v as "percentage" | "fixed_amount" })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2">
                <RadioGroupItem value="percentage" /> Porcentaje
              </label>
              <label className="flex items-center gap-2">
                <RadioGroupItem value="fixed_amount" /> Importe fijo
              </label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor {form.discount_type === "percentage" ? "(%)" : "(€)"}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Mínimo de pedido (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.min_order_amount ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    min_order_amount: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Caduca el</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Límite global de usos</Label>
              <Input
                type="number"
                step="1"
                value={form.usage_limit ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    usage_limit: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Activo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.code.trim() || !form.name.trim()}>
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Assignments dialog
// ---------------------------------------------------------------------------

const AssignmentsDialog = ({
  discount,
  onClose,
}: {
  discount: Discount;
  onClose: () => void;
}) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, a] = await Promise.all([
        supabase.rpc("list_users_with_roles"),
        supabase
          .from("discount_assignments")
          .select("user_id")
          .eq("discount_id", discount.id),
      ]);
      if (u.data) setUsers(u.data as UserRow[]);
      if (a.data) {
        setAssigned(new Set((a.data as { user_id: string }[]).map((r) => r.user_id)));
      }
      setLoading(false);
    })();
  }, [discount.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)),
    );
  }, [users, search]);

  const toggle = (uid: string) => {
    const next = new Set(assigned);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setAssigned(next);
  };

  const save = async () => {
    setSaving(true);
    const current = new Set<string>();
    {
      const { data } = await supabase
        .from("discount_assignments")
        .select("user_id")
        .eq("discount_id", discount.id);
      (data || []).forEach((r: { user_id: string }) => current.add(r.user_id));
    }
    const toAdd = [...assigned].filter((u) => !current.has(u));
    const toRemove = [...current].filter((u) => !assigned.has(u));

    if (toAdd.length) {
      const rows = toAdd.map((u) => ({ discount_id: discount.id, user_id: u }));
      const { error } = await supabase.from("discount_assignments").insert(rows);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from("discount_assignments")
        .delete()
        .eq("discount_id", discount.id)
        .in("user_id", toRemove);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    setSaving(false);
    toast.success("Asignaciones guardadas");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Asignar usuarios a {discount.code}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sin selección → el código es público. Con selección → solo los usuarios marcados pueden usarlo.
          </p>
          <Input
            placeholder="Buscar por email o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[40vh] overflow-y-auto border border-border rounded-md divide-y divide-border">
            {loading && <div className="p-4 text-muted-foreground text-sm">Cargando…</div>}
            {!loading && filtered.length === 0 && (
              <div className="p-4 text-muted-foreground text-sm">Sin resultados</div>
            )}
            {filtered.map((u) => (
              <label
                key={u.user_id}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={assigned.has(u.user_id)}
                  onChange={() => toggle(u.user_id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-body text-sm truncate">{u.full_name || "—"}</div>
                  <div className="font-body text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar asignaciones"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDiscounts;
