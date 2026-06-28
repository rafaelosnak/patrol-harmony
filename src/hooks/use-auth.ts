import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supervisor" | "vigia" | "central" | "super_admin";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  company_id: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async (u: User | null) => {
      if (!u) {
        setProfile(null); setRoles([]); return;
      }
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
      ]);
      if (!mounted) return;
      setProfile((p as Profile) ?? null);
      setRoles(((r as { role: AppRole }[] | null) ?? []).map((x) => x.role));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setTimeout(() => load(session?.user ?? null), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      load(data.session?.user ?? null).finally(() => mounted && setLoading(false));
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const hasRole = (r: AppRole) => roles.includes(r);
  const isStaff = roles.some((r) => ["admin", "supervisor", "central"].includes(r));
  const isSuperAdmin = roles.includes("super_admin");
  const companyId = profile?.company_id ?? null;

  return { user, profile, roles, hasRole, isStaff, isSuperAdmin, companyId, loading };
}
