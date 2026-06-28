import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CompanyStatus = "active" | "suspended" | "overdue";
export type CompanyPlan = "starter" | "pro" | "business" | "enterprise";

export interface CompanyInput {
  name: string;
  cnpj?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  status?: CompanyStatus;
  monthly_fee?: number;
  billing_day?: number;
  due_date?: string | null;
  notes?: string | null;
  plan?: CompanyPlan;
  max_users?: number;
}

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (!ok) throw new Error("Apenas super administradores podem executar esta ação");
}

export const createCompanyWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CompanyInput & { admin_email: string; admin_password: string; admin_full_name: string }) => {
    if (!input.name?.trim()) throw new Error("Nome da empresa é obrigatório");
    if (!input.admin_email || !input.admin_password || !input.admin_full_name) {
      throw new Error("Dados do administrador são obrigatórios");
    }
    if (input.admin_password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error: cErr } = await supabaseAdmin.from("companies").insert({
      name: data.name.trim(),
      cnpj: data.cnpj || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      status: data.status ?? "active",
      monthly_fee: Number(data.monthly_fee) || 0,
      billing_day: Number(data.billing_day) || 5,
      due_date: data.due_date || null,
      notes: data.notes || null,
      plan: data.plan ?? "pro",
      max_users: Number(data.max_users) || 15,
    }).select("id").single();
    if (cErr) throw new Error(cErr.message);

    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.admin_email,
      password: data.admin_password,
      email_confirm: true,
      user_metadata: { full_name: data.admin_full_name },
    });
    if (uErr) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      throw new Error(uErr.message);
    }
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.admin_full_name,
      company_id: company.id,
    }).eq("id", uid);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });

    return { company_id: company.id, user_id: uid };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string } & CompanyInput) => {
    if (!input.id || !input.name?.trim()) throw new Error("Dados incompletos");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("companies").update({
      name: rest.name.trim(),
      cnpj: rest.cnpj || null,
      contact_email: rest.contact_email || null,
      contact_phone: rest.contact_phone || null,
      address: rest.address || null,
      status: rest.status,
      monthly_fee: Number(rest.monthly_fee) || 0,
      billing_day: Number(rest.billing_day) || 5,
      due_date: rest.due_date || null,
      notes: rest.notes || null,
      ...(rest.plan ? { plan: rest.plan } : {}),
      ...(rest.max_users != null ? { max_users: Number(rest.max_users) || 0 } : {}),
    }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: CompanyStatus }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("companies").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerCompanyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; billing_day: number }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    next.setDate(Number(data.billing_day) || 5);
    const { error } = await supabaseAdmin.from("companies").update({
      status: "active",
      last_payment_at: new Date().toISOString(),
      due_date: next.toISOString().slice(0, 10),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCompanyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { company_id: string; email: string; password: string; full_name: string }) => {
    if (!input.company_id || !input.email || !input.password || !input.full_name) {
      throw new Error("Campos obrigatórios faltando");
    }
    if (input.password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canAdd } = await supabaseAdmin.rpc("company_can_add_user", { _company_id: data.company_id });
    if (canAdd === false) throw new Error("Limite de usuários do plano atingido. Faça upgrade do plano da empresa.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      company_id: data.company_id,
    }).eq("id", uid);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    return { user_id: uid };
  });

export const listCompanyAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { company_id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", data.company_id);
    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids)
      .eq("role", "admin");
    const adminIds = new Set((roles ?? []).map((r) => r.user_id));
    return (profiles ?? []).filter((p) => adminIds.has(p.id));
  });

export const listSuperAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .in("id", ids);
    return profiles ?? [];
  });
