import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Restringe acesso à rota para staff (admin, supervisor, central).
 * Vigia é redirecionado para a página de escala.
 */
export function useStaffGuard() {
  const { isStaff, loading, hasRole } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isStaff) {
      const dest = hasRole("vigia") ? "/escalas" : "/dashboard";
      navigate({ to: dest, replace: true });
    }
  }, [loading, isStaff, navigate, hasRole]);
  return { allowed: isStaff, loading };
}

/**
 * Redireciona vigias para fora de páginas operacionais staff-only
 * (dashboard, mapa, equipes), mas permite admin/supervisor/central.
 */
export function useNoVigiaGuard() {
  const { hasRole, isStaff, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (isSuperAdmin || isStaff) return;
    if (hasRole("vigia")) navigate({ to: "/escalas", replace: true });
  }, [hasRole, isStaff, isSuperAdmin, loading, navigate]);
}

