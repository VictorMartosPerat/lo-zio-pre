import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { EU_ALLERGENS } from "@/lib/allergens";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_active: boolean | null;
  allergens: string[] | null;
  badge_key: string | null;
  badge_emoji: string | null;
  badge_style: string | null;
  sort_order: number | null;
}

const CATEGORIES = ["pizzas", "focaccias", "calzones", "extras", "drinks", "desserts"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  pizzas: "Pizzas", focaccias: "Focaccias", calzones: "Calzones",
  extras: "Extras", drinks: "Bebidas", desserts: "Postres",
};
const BADGE_STYLES = ["", "fire", "gold", "teal"] as const;

const emptyProduct: Omit<Product, "id"> = {
  name: "",
  description: "",
  price: 0,
  category: "pizzas",
  is_active: true,
  allergens: [],
  badge_key: null,
  badge_emoji: null,
  badge_style: null,
  sort_order: 0,
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Product, "id">>(emptyProduct);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inlinePriceId, setInlinePriceId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState("");

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("category")
      .order("sort_order");
    if (error) toast.error("Error al cargar productos");
    setProducts((data as Product[]) || []);
    setLoading(false);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", price: Number(p.price),
      category: p.category, is_active: p.is_active ?? true,
      allergens: p.allergens ?? [], badge_key: p.badge_key, badge_emoji: p.badge_emoji,
      badge_style: p.badge_style, sort_order: p.sort_order ?? 0,
    });
  };

  const openCreate = () => {
    setCreating(true);
    setForm({ ...emptyProduct, category: filterCategory !== "all" ? filterCategory : "pizzas" });
  };

  const closeDialog = () => { setEditing(null); setCreating(false); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.price < 0) { toast.error("Precio inválido"); return; }

    const payload = {
      ...form,
      description: form.description?.trim() || null,
      badge_key: form.badge_key?.trim() || null,
      badge_emoji: form.badge_emoji?.trim() || null,
      badge_style: form.badge_style || null,
    };

    if (editing) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", editing.id);
      if (error) { toast.error("Error al guardar: " + error.message); return; }
      toast.success("Producto actualizado");
    } else {
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) { toast.error("Error al crear: " + error.message); return; }
      toast.success("Producto creado");
    }
    closeDialog();
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", deleteId);
    if (error) { toast.error("Error al eliminar: " + error.message); }
    else { toast.success("Producto eliminado"); fetchProducts(); }
    setDeleteId(null);
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("menu_items").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success(p.is_active ? "Producto oculto" : "Producto visible"); fetchProducts(); }
  };

  const saveInlinePrice = async (id: string) => {
    const v = parseFloat(inlinePriceValue);
    if (isNaN(v) || v < 0) { toast.error("Precio inválido"); return; }
    const { error } = await supabase.from("menu_items").update({ price: v }).eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Precio actualizado"); setInlinePriceId(null); fetchProducts(); }
  };

  const toggleAllergen = (id: string) => {
    setForm((f) => {
      const list = f.allergens ?? [];
      return { ...f, allergens: list.includes(id) ? list.filter((a) => a !== id) : [...list, id] };
    });
  };

  const filtered = filterCategory === "all" ? products : products.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-foreground">Productos del menú</h2>
          <p className="font-body text-sm text-muted-foreground">Edita precios, descripciones y disponibilidad.</p>
        </div>
        <Button onClick={openCreate} className="font-body">
          <Plus className="w-4 h-4 mr-2" /> Nuevo producto
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-body transition-colors ${filterCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >Todos ({products.length})</button>
        {CATEGORIES.map((c) => {
          const count = products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-body capitalize transition-colors ${filterCategory === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >{CATEGORY_LABELS[c] ?? c} ({count})</button>
          );
        })}
      </div>

      {loading ? (
        <p className="font-body text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="font-body text-muted-foreground text-center py-8">Sin productos.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <div key={p.id} className={`border border-border rounded-lg p-4 bg-card ${!p.is_active ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg text-foreground">{p.name}</h3>
                    <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[p.category] ?? p.category}</Badge>
                    {p.badge_emoji && <span className="text-base">{p.badge_emoji}</span>}
                    {!p.is_active && <Badge variant="secondary" className="text-xs">Oculto</Badge>}
                  </div>
                  {p.description && <p className="font-body text-sm text-muted-foreground mt-1">{p.description}</p>}
                  {p.allergens && p.allergens.length > 0 && (
                    <p className="font-body text-xs text-muted-foreground mt-1">Alérgenos: {p.allergens.join(", ")}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {inlinePriceId === p.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" step="0.01" min="0"
                        value={inlinePriceValue}
                        onChange={(e) => setInlinePriceValue(e.target.value)}
                        className="w-24 h-9"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={() => saveInlinePrice(p.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setInlinePriceId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setInlinePriceId(p.id); setInlinePriceValue(String(p.price)); }}
                      className="font-display text-xl text-primary hover:underline"
                      title="Click para editar precio"
                    >{Number(p.price).toFixed(2)} €</button>
                  )}

                  <Switch checked={!!p.is_active} onCheckedChange={() => toggleActive(p)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={!!editing || creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Categoría</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-body"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Precio (€)</Label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Orden</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="mb-2">Visible</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Badge (texto)</Label>
                <Input value={form.badge_key ?? ""} onChange={(e) => setForm({ ...form, badge_key: e.target.value })} placeholder="Ej: NUEVA" />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={form.badge_emoji ?? ""} onChange={(e) => setForm({ ...form, badge_emoji: e.target.value })} placeholder="🔥" />
              </div>
              <div>
                <Label>Estilo badge</Label>
                <select
                  value={form.badge_style ?? ""}
                  onChange={(e) => setForm({ ...form, badge_style: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-body"
                >
                  {BADGE_STYLES.map((s) => <option key={s} value={s}>{s || "ninguno"}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Alérgenos</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {EU_ALLERGENS.map((a) => {
                  const selected = (form.allergens ?? []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAllergen(a.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >{a.emoji} {a.name}</button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProducts;
