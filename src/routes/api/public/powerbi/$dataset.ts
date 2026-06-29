import { createFileRoute } from "@tanstack/react-router";

const DATASETS: Record<string, { table: string; select: string; orderBy?: string }> = {
  rounds: {
    table: "rounds",
    select: "id,user_id,client_id,vehicle_id,status,mode,started_at,finished_at,checkpoints_done,checkpoints_total,company_id",
    orderBy: "started_at",
  },
  occurrences: {
    table: "occurrences",
    select: "id,user_id,client_id,title,severity,status,created_at,closed_at,company_id",
    orderBy: "created_at",
  },
  shifts: {
    table: "shifts",
    select: "id,user_id,client_id,shift_type,start_at,end_at,status,company_id",
    orderBy: "start_at",
  },
  time_entries: {
    table: "time_entries",
    select: "id,user_id,client_id,punch_type,punched_at,latitude,longitude,company_id",
    orderBy: "punched_at",
  },
  alerts: {
    table: "alerts",
    select: "id,user_id,alert_type,status,created_at,acknowledged_at,company_id",
    orderBy: "created_at",
  },
  absences: {
    table: "absences",
    select: "id,user_id,shift_id,absence_date,kind,status,auto_generated,reason,company_id",
    orderBy: "absence_date",
  },
  profiles: {
    table: "profiles",
    select: "id,full_name,email,status,default_shift_type,work_period,company_id,created_at",
  },
  clients: {
    table: "clients",
    select: "id,name,cnpj,address,city,state,phone,whatsapp,latitude,longitude,company_id,created_at",
  },
};

export const Route = createFileRoute("/api/public/powerbi/$dataset")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const companyId = url.searchParams.get("company");
        const apiKey = url.searchParams.get("key") ?? request.headers.get("x-api-key");
        const format = (url.searchParams.get("format") ?? "json").toLowerCase();
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5000", 10) || 5000, 50000);

        const ds = DATASETS[params.dataset];
        if (!ds) return json({ error: "Unknown dataset" }, 404);
        if (!companyId || !apiKey) return json({ error: "Missing company or key" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: company, error: cErr } = await supabaseAdmin
          .from("companies")
          .select("id,powerbi_api_key,status")
          .eq("id", companyId)
          .maybeSingle();
        if (cErr || !company || company.powerbi_api_key !== apiKey) {
          return json({ error: "Invalid credentials" }, 401);
        }
        if (company.status !== "active") return json({ error: "Company not active" }, 403);

        const sb = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (c: string, v: string) => {
                limit: (n: number) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } & Promise<{ data: unknown; error: { message: string } | null }>;
              };
            };
          };
        };
        let q = sb.from(ds.table).select(ds.select).eq("company_id", companyId).limit(limit);
        const res = ds.orderBy ? await q.order(ds.orderBy, { ascending: false }) : await q;
        const { data, error } = res;
        if (error) return json({ error: error.message }, 500);

        if (format === "csv") {
          const rows = (data ?? []) as Record<string, unknown>[];
          const headers = rows.length ? Object.keys(rows[0]) : ds.select.split(",");
          const escape = (v: unknown) => {
            if (v === null || v === undefined) return "";
            const s = typeof v === "object" ? JSON.stringify(v) : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };
          const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
          return new Response(csv, {
            status: 200,
            headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
          });
        }

        return json({ dataset: params.dataset, count: data?.length ?? 0, data: data ?? [] }, 200);
      },
    },
  },
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
