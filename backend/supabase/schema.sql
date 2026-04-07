-- Mars Face Agent — Supabase Schema
-- Run this against your Supabase SQL editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists clients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email                 text unique not null,
  risk_tier             text not null default 'moderate',
  subscription_tier     text not null default 'basic',   -- basic | pro | elite
  voice_to_voice_enabled boolean not null default false,
  trading_enabled        boolean not null default false,  -- enable trading features per client
  device_token          text,                            -- FCM push token
  mt5_account_id        text,
  poly_wallet           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Device registry for 30-phone fleet management
create table if not exists device_registry (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  device_id    text not null unique,                     -- Android device fingerprint
  app_version  text,
  last_seen    timestamptz not null default now(),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists dash_metrics (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  metric_key   text not null,
  metric_value numeric not null,
  context      jsonb default '{}',
  recorded_at  timestamptz not null default now()
);

create table if not exists agent_activity (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  action_type  text not null,
  description  text,
  confidence   numeric,
  metadata     jsonb default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists task_queue (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  task_type     text not null,
  payload       jsonb default '{}',
  status        text not null default 'pending',
  priority      int not null default 5,
  scheduled_for timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists trade_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  platform    text not null,
  symbol      text not null,
  side        text not null,
  qty         numeric not null,
  price       numeric not null,
  pnl         numeric,
  strategy    text,
  metadata    jsonb default '{}',
  executed_at timestamptz not null default now()
);

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  event_type text not null,
  detail     jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_agent_activity_client_created
  on agent_activity (client_id, created_at desc);

create index if not exists idx_trade_log_client_executed
  on trade_log (client_id, executed_at desc);

create index if not exists idx_task_queue_client_created
  on task_queue (client_id, created_at desc);

create index if not exists idx_task_queue_status_priority
  on task_queue (status, priority asc, scheduled_for asc);

create index if not exists idx_dash_metrics_client_recorded
  on dash_metrics (client_id, recorded_at desc);

create index if not exists idx_audit_log_client_created
  on audit_log (client_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table clients enable row level security;
alter table dash_metrics enable row level security;
alter table agent_activity enable row level security;
alter table task_queue enable row level security;
alter table trade_log enable row level security;
alter table conversations enable row level security;
alter table audit_log enable row level security;

-- Clients: users can only see their own row
create policy "clients_own_row" on clients
  for all using (id = auth.uid());

-- All child tables: users can only access rows matching their client_id
create policy "dash_metrics_own" on dash_metrics
  for all using (client_id = auth.uid());

create policy "agent_activity_own" on agent_activity
  for all using (client_id = auth.uid());

create policy "task_queue_own" on task_queue
  for all using (client_id = auth.uid());

create policy "trade_log_own" on trade_log
  for all using (client_id = auth.uid());

create policy "conversations_own" on conversations
  for all using (client_id = auth.uid());

create policy "audit_log_own" on audit_log
  for all using (client_id = auth.uid());

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

-- ============================================================
-- AGENT CONFIG (per-client customization)
-- ============================================================

create table if not exists agent_config (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null unique references clients(id) on delete cascade,
  agent_name          text not null default 'Mars',
  personality         text not null default 'professional', -- professional|casual|friendly|aggressive|direct
  elevenlabs_voice_id text not null default 'TxGEqnHWrfWFTfGW9XjX',
  tavus_replica_id    text,
  tools_enabled       jsonb not null default '["phone_command","send_sms","make_call","set_alarm","web_search"]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- WORKFLOWS (admin-managed Make / n8n workflows for distribution)
-- ============================================================

create table if not exists workflows (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  platform      text not null check (platform in ('make', 'n8n')),
  workflow_json jsonb,                                    -- exported workflow payload
  guide_title   text,                                     -- setup guide title
  guide_steps   jsonb not null default '[]',              -- array of { step, text, image_url? }
  tags          text[] not null default '{}',
  version       text not null default '1.0',
  is_active     boolean not null default true,
  created_by    uuid references clients(id),              -- admin who created it
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists workflow_assignments (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references workflows(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','sent','viewed','setup_complete','error')),
  sent_at       timestamptz not null default now(),
  viewed_at     timestamptz,
  completed_at  timestamptz,
  notes         text,
  unique(workflow_id, client_id)
);

-- Add admin flag to clients for workflow management
alter table clients add column if not exists is_admin boolean not null default false;

create index if not exists idx_workflows_platform on workflows (platform);
create index if not exists idx_workflow_assignments_client on workflow_assignments (client_id, sent_at desc);
create index if not exists idx_workflow_assignments_workflow on workflow_assignments (workflow_id);

alter table workflows enable row level security;
alter table workflow_assignments enable row level security;

-- Admins can manage all workflows; clients can see assigned ones
create policy "workflows_admin_all" on workflows
  for all using (
    exists (select 1 from clients where id = auth.uid() and is_admin = true)
  );

create policy "workflow_assignments_own" on workflow_assignments
  for select using (client_id = auth.uid());

create policy "workflow_assignments_admin" on workflow_assignments
  for all using (
    exists (select 1 from clients where id = auth.uid() and is_admin = true)
  );

create trigger workflows_updated_at
  before update on workflows
  for each row execute function update_updated_at();
