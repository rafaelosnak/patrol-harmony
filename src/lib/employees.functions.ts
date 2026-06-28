import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "supervisor" | "vigia" | "central" | "super_admin";

export interface EmployeeProfileInput {
  full_name: string;
  phone?: string | null;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  hired_at?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
}

async function syncClientAssignments(
  supabaseAdmin: { from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<unknown> }; insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }> } },
  userId: string,
  companyId: string | null,
  clientIds: string[] | undefined,
) {
  if (!clientIds) return;
  await supabaseAdmin.from("client_employees").delete().eq("user_id", userId);
  if (clientIds.length === 0 || !companyId) return;
  const rows = clientIds.map((cid) => ({ user_id: userId, client_id: cid, company_id: companyId }));
  const { error } = await supabaseAdmin.from("client_employees").insert(rows);
  if (error) throw new Error(error.message);
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; role: AppRole; client_ids?: string[] } & EmployeeProfileInput) => {
    if (!input.email || !input.password || !input.full_name || !input.role) {
      throw new Error("Campos obrigatórios faltando");
    }
    if (input.password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAllowed } = await context.supabase.rpc("is_supervisor_or_admin", { _user_id: context.userId });
    if (!isAllowed) throw new Error("Apenas administradores ou supervisores podem cadastrar funcionários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    const profileUpdate = {
      phone: data.phone ?? null,
      cpf: data.cpf ?? null,
      rg: data.rg ?? null,
      birth_date: data.birth_date || null,
      hired_at: data.hired_at || null,
      address_street: data.address_street ?? null,
      address_number: data.address_number ?? null,
      address_complement: data.address_complement ?? null,
      address_district: data.address_district ?? null,
      address_city: data.address_city ?? null,
      address_state: data.address_state ?? null,
      address_zip: data.address_zip ?? null,
      notes: data.notes ?? null,
      avatar_url: data.avatar_url ?? null,
    };
    await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", uid);

    const { data: companyRow } = await context.supabase.rpc("get_user_company", { _user_id: context.userId });
    await syncClientAssignments(supabaseAdmin as unknown as Parameters<typeof syncClientAssignments>[0], uid, (companyRow as string | null) ?? null, data.client_ids);
    return { id: uid };
  });

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; client_ids?: string[] } & EmployeeProfileInput) => {
    if (!input.user_id || !input.full_name) throw new Error("Dados incompletos");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: ok2 } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "supervisor" });
    if (!ok && !ok2) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, client_ids, ...rest } = data;
    const { error } = await supabaseAdmin.from("profiles").update({
      full_name: rest.full_name,
      phone: rest.phone ?? null,
      cpf: rest.cpf ?? null,
      rg: rest.rg ?? null,
      birth_date: rest.birth_date || null,
      hired_at: rest.hired_at || null,
      address_street: rest.address_street ?? null,
      address_number: rest.address_number ?? null,
      address_complement: rest.address_complement ?? null,
      address_district: rest.address_district ?? null,
      address_city: rest.address_city ?? null,
      address_state: rest.address_state ?? null,
      address_zip: rest.address_zip ?? null,
      notes: rest.notes ?? null,
      avatar_url: rest.avatar_url ?? null,
    }).eq("id", user_id);
    if (error) throw new Error(error.message);

    const { data: companyRow } = await context.supabase.rpc("get_user_company", { _user_id: context.userId });
    await syncClientAssignments(supabaseAdmin as unknown as Parameters<typeof syncClientAssignments>[0], user_id, (companyRow as string | null) ?? null, client_ids);
    return { ok: true };
  });

export const updateEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: AppRole }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAllowed } = await context.supabase.rpc("is_supervisor_or_admin", { _user_id: context.userId });
    if (!isAllowed) throw new Error("Apenas administradores ou supervisores podem alterar papéis");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAllowed } = await context.supabase.rpc("is_supervisor_or_admin", { _user_id: context.userId });
    if (!isAllowed) throw new Error("Apenas administradores ou supervisores podem remover funcionários");
    if (data.user_id === context.userId) throw new Error("Você não pode remover a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; password: string }) => {
    if (!input.user_id) throw new Error("Usuário obrigatório");
    if (!input.password || input.password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAllowed } = await context.supabase.rpc("is_supervisor_or_admin", { _user_id: context.userId });
    if (!isAllowed) throw new Error("Apenas administradores podem alterar senha de funcionários");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ensure target user is in same company
    const { data: callerCompany } = await context.supabase.rpc("get_user_company", { _user_id: context.userId });
    const { data: targetProfile } = await supabaseAdmin.from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!targetProfile || (targetProfile as { company_id: string | null }).company_id !== callerCompany) {
      throw new Error("Funcionário não pertence à sua empresa");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
