import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, ShieldOff, Search, Pizza } from "lucide-react";

type AppRole = "admin" | "pizzeriaTarragona" | "pizzeriaArrabassada";

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

const PIZZERIA_ROLES: { role: AppRole; label: string; short: string }[] = [
  { role: "pizzeriaTarragona", label: "Pizzería Tarragona", short: "Tarragona" },
  { role: "pizzeriaArrabassada", label: "Pizzería Arrabassada", short: "Arrabassada" },
];

const AdminUserRoles = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_users_with_roles");
    if (error) {
      toast.error("Error cargando usuarios: " + error.message);
      setLoading(false);
      return;
    }
    setUsers((data as UserWithRoles[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grantRole = async (userId: string, role: AppRole) => {
    setBusyKey(userId + role);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    setBusyKey(null);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success(`Rol ${role} concedido`);
    load();
  };

  const revokeRole = async (userId: string, role: AppRole) => {
    setBusyKey(userId + role);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    setBusyKey(null);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success(`Rol ${role} revocado`);
    load();
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email?.toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="font-body"
        />
      </div>

      <div className="text-sm text-muted-foreground font-body">
        {filtered.length} usuario{filtered.length !== 1 && "s"}
      </div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const isAdmin = u.roles.includes("admin");
          const adminBusy = busyKey === u.user_id + "admin";
          return (
            <div
              key={u.user_id}
              className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-semibold text-foreground truncate">
                      {u.full_name || u.email}
                    </span>
                    {isAdmin && (
                      <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">
                        <Shield className="w-3 h-3 mr-1" /> Admin
                      </Badge>
                    )}
                    {PIZZERIA_ROLES.map(({ role, short }) =>
                      u.roles.includes(role) ? (
                        <Badge key={role} variant="secondary" className="bg-accent/40 text-foreground">
                          <Pizza className="w-3 h-3 mr-1" /> {short}
                        </Badge>
                      ) : null
                    )}
                  </div>
                  {u.full_name && (
                    <p className="text-xs text-muted-foreground font-body truncate">{u.email}</p>
                  )}
                </div>

                {isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adminBusy}
                    onClick={() => revokeRole(u.user_id, "admin")}
                    className="font-body"
                  >
                    {adminBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldOff className="w-4 h-4 mr-1" /> Quitar admin
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={adminBusy}
                    onClick={() => grantRole(u.user_id, "admin")}
                    className="font-body"
                  >
                    {adminBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-1" /> Hacer admin
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {PIZZERIA_ROLES.map(({ role, label }) => {
                  const has = u.roles.includes(role);
                  const busy = busyKey === u.user_id + role;
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "outline" : "secondary"}
                      disabled={busy}
                      onClick={() => (has ? revokeRole(u.user_id, role) : grantRole(u.user_id, role))}
                      className="font-body"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Pizza className="w-4 h-4 mr-1" />
                          {has ? `Quitar ${label}` : `Asignar ${label}`}
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground font-body py-8">
            No hay usuarios que coincidan con la búsqueda.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminUserRoles;
