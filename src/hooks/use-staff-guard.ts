import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Restringe acesso à rota para staff (admin, supervisor, central).
 * Vigia é redirecionado para o dashboard.
 */
export function useStaffGuard() {
  const { isStaff, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isStaff) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isStaff, navigate]);
  return { allowed: isStaff, loading };
}
