
# Refatoração Multi-Tenant + Super Admin + Cobrança

## Objetivo
Transformar o app em SaaS multi-tenant: cada **empresa de segurança** gerencia seus próprios clientes, funcionários, rondas, etc., isolados por RLS. Um **super admin** global cadastra empresas, controla pagamento e pode bloquear acesso. Remover "Unidades" e atrelar funcionário diretamente ao cliente.

---

## 1. Banco de dados (migração)

### Nova tabela `companies` (empresas de segurança / tenants)
- `id`, `name`, `cnpj`, `contact_email`, `contact_phone`, `address`
- `status`: `active` | `suspended` | `overdue`
- `monthly_fee` (numeric), `billing_day` (1–28), `due_date` (próximo vencimento), `last_payment_at`
- `created_at`, `updated_at`

### Novo role `super_admin`
- Adicionar ao enum `app_role`.
- Função `is_super_admin(uuid)` security definer.
- Função `company_is_active(uuid)` → true se status='active' (usada nas policies).

### Adicionar `company_id` em todas as tabelas operacionais
`profiles`, `user_roles`, `clients`, `employees…`, `rounds`, `round_checkpoints`, `checkpoint_locations`, `occurrences`, `alerts`, `shifts`, `time_entries`, `vehicles`, `announcements`, `messages`.
- FK para `companies(id) ON DELETE CASCADE`.
- Função `get_user_company(uuid)` security definer.

### Tabela `client_employees` (atrelar vigia a cliente)
- `client_id`, `user_id`, `company_id`, `created_at` (unique client+user).

### Remover `units`
- `DROP TABLE public.units CASCADE` (usuário confirmou: sem migração).
- Remover `unit_id` de `rounds`, `shifts`, etc., substituindo por `client_id` quando aplicável.

### RLS — reescrever todas as policies
- Padrão: `company_id = get_user_company(auth.uid()) AND company_is_active(company_id)`.
- `super_admin` bypassa via `OR is_super_admin(auth.uid())`.
- `companies`: somente super_admin lê/edita todas; admin da empresa lê apenas a própria (read-only).

### Trigger `handle_new_user` atualizado
- Não auto-promover. Usuário criado sem `company_id` fica órfão até super_admin atribuir, OU é criado já com `company_id` pelo fluxo de cadastro da empresa.

---

## 2. Frontend

### Novo menu "Super Admin" (visível só com role `super_admin`)
Rota `/super-admin/empresas`:
- Listar empresas, status, vencimento, mensalidade.
- Cadastrar nova empresa + criar usuário admin inicial dela (server fn com `supabaseAdmin`).
- Editar empresa, marcar como `active`/`overdue`/`suspended`, registrar pagamento (atualiza `last_payment_at` e empurra `due_date` +1 mês).

### Gate de bloqueio
- Hook `useCompanyStatus` consulta o status da empresa do usuário logado.
- Em `_authenticated/route.tsx` (ou wrapper): se `status !== 'active'` e não for super_admin, mostrar tela "Acesso suspenso — entre em contato com o financeiro" em vez do app.

### Remover "Unidades"
- Remover item do sidebar, rota `/unidades`, referências em `rondas.tsx`, `escalas.tsx`, `dashboard.tsx`, `mapa.tsx`, `relatorios.tsx`, `equipes.tsx`.
- Onde havia seleção de unit, passar a usar **client**.

### Clientes (expandir cadastro)
- Adicionar campos: `contact_email`, `contact_phone` (WhatsApp), `notes`. Manter `address` com preview Maps.
- Botão "Vigias atendentes" no card do cliente → dialog para adicionar/remover funcionários (`client_employees`).

### Funcionários
- Mostrar "Clientes atendidos" (lista) na linha do funcionário.
- Filtro de funcionário por cliente nas telas operacionais.

### Sidebar atualizado
- Remover "Unidades".
- Adicionar grupo "Super Admin" → "Empresas" (condicional ao role).

---

## 3. Server functions
- `createCompany({ name, cnpj, admin_email, admin_password, monthly_fee, billing_day })` — super_admin only. Cria company + cria user admin + atrela.
- `updateCompanyStatus({ company_id, status })` — super_admin only.
- `registerCompanyPayment({ company_id })` — super_admin only; avança `due_date`.
- `assignClientEmployee` / `removeClientEmployee` — admin/supervisor da empresa.

---

## 4. Detalhes técnicos
- Todas as policies novas usam `get_user_company` + `company_is_active` para evitar recursão.
- `super_admin` é criado manualmente via SQL ou via primeiro usuário do sistema (a definir).
- Dados existentes: como é refatoração estrutural, criamos **uma company "default"** na migração e atribuímos todos os dados existentes a ela, para não quebrar nada.
- Storage buckets (`round-photos`, `employee-docs`, `avatars`) continuam, mas paths podem incluir `company_id/...` (não obrigatório nesta fase; pode ficar para depois).

---

## 5. Escopo desta entrega
**Inclui:** schema multi-tenant completo, RLS, super admin UI (CRUD empresas + cobrança manual), gate de bloqueio, remover Unidades, atrelar funcionário-cliente, expandir cadastro de cliente.

**Não inclui:** integração de pagamento automático (Stripe), notificações automáticas de vencimento por email, audit log de ações do super admin, isolamento de storage por company.

---

## Pergunta antes de executar
Como vou criar o **primeiro super_admin**? Opções:
- (a) Promover o usuário atual (você) via SQL na própria migração — me diga seu email.
- (b) Criar um novo usuário super_admin com email/senha que você fornecer.

Confirme a opção e seguimos com a migração.
