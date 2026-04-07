-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/bpmfauclfwixltwzbcyy/sql/new

create table if not exists device_registry (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  device_id    text not null unique,
  app_version  text,
  last_seen    timestamptz not null default now(),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
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

create table if not exists agent_config (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null unique references clients(id) on delete cascade,
  agent_name          text not null default 'Mars',
  personality         text not null default 'professional',
  elevenlabs_voice_id text not null default 'TxGEqnHWrfWFTfGW9XjX',
  tavus_replica_id    text,
  tools_enabled       jsonb not null default '["phone_command","send_sms","make_call","set_alarm","web_search"]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
