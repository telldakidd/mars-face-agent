-- Run this in your Supabase SQL editor to enable CRM + Expense persistence

create table if not exists crm_leads (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null,
  name             text not null,
  company          text default '',
  email            text default '',
  phone            text default '',
  stage            text default 'new' check (stage in ('new','contacted','proposal','negotiating','won','lost')),
  value            numeric default 0,
  notes            text default '',
  created_at       timestamptz default now(),
  last_contact_at  timestamptz default now()
);

create index if not exists crm_leads_client_id_idx on crm_leads(client_id);

create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,
  amount       numeric not null,
  category     text default 'other' check (category in ('food','travel','software','marketing','equipment','other')),
  description  text default '',
  date         date not null default current_date,
  created_at   timestamptz default now()
);

create index if not exists expenses_client_id_idx on expenses(client_id);
