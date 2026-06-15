-- BasketBot telemetry tables
-- Paste this entire file into: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists basketbot_status (
  bot                  text primary key,
  balance              numeric,
  equity               numeric,
  floating_pnl         numeric,
  hwm                  numeric,
  dd_from_hwm_pct      numeric,
  daily_pnl_pct        numeric,
  weekly_pnl_pct       numeric,
  monthly_pnl_pct      numeric,
  positions            int,
  buy_lots             numeric,
  sell_lots            numeric,
  net_exposure_pct     numeric,
  phase                text,
  kill_switch          boolean,
  lot_reduction_active boolean,
  daily_loss_pct       numeric,
  trades_today         int,
  total_trades         int,
  total_wins           int,
  win_rate             numeric,
  base_lot_current     numeric,
  last_heartbeat       timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists basketbot_trades (
  id         uuid primary key default gen_random_uuid(),
  bot        text not null,
  symbol     text not null,
  side       text,
  lots       numeric,
  entry      numeric,
  exit_price numeric,
  pnl        numeric,
  status     text not null default 'open',
  category   text,
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz
);

create index if not exists idx_bbt_bot_opened on basketbot_trades (bot, opened_at desc);
