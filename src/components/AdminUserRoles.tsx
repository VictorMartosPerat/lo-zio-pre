import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, ShieldOff, Search } from "lucide-react";

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

const AdminUserRoles = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const grantAdmin = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    setBusyId(null);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Rol admin concedido");
    load();
  };

  const revokeAdmin = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    setBusyId(null);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Rol admin revocado");
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
          const isBusy = busyId === u.user_id;
          return (
            <div
              key={u.user_id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card"
            >
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
                </div>
                {u.full_name && (
                  <p className="text-xs text-muted-foreground font-body truncate">{u.email}</p>
                )}
              </div>

              {isAdmin ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => revokeAdmin(u.user_id)}
                  className="font-body"
                >
                  {isBusy ? (
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
                  disabled={isBusy}
                  onClick={() => grantAdmin(u.user_id)}
                  className="font-body"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-1" /> Hacer admin
                    </>
                  )}
                </Button>
              )}
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
