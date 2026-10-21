-- DUCKZINHA: apenas tabelas próprias; não altera as tabelas do Duckzin Bridge.
-- Execute uma vez no SQL Editor do Supabase, sob supervisão de quem administra o projeto.
create table if not exists public.duckzinha_memory (
  guild_id text not null,
  discord_user_id text not null,
  enabled boolean not null default false,
  preferred_name text,
  updated_at timestamptz not null default now(),
  primary key (guild_id, discord_user_id),
  constraint duckzinha_memory_name_length check (preferred_name is null or length(preferred_name) <= 30)
);

create table if not exists public.duckzinha_knowledge (
  guild_id text not null,
  topic text not null,
  answer text not null,
  updated_at timestamptz not null default now(),
  primary key (guild_id, topic),
  constraint duckzinha_topic_length check (length(topic) between 2 and 50),
  constraint duckzinha_answer_length check (length(answer) between 1 and 1000)
);

create table if not exists public.duckzinha_expiring_messages (
  message_id text primary key,
  guild_id text not null,
  channel_id text not null,
  expires_at timestamptz not null
);
create index if not exists duckzinha_expiring_messages_expires_idx
  on public.duckzinha_expiring_messages (expires_at);

-- Sem leitura/escrita direta para visitantes. O bot usa service_role APENAS no servidor.
alter table public.duckzinha_memory enable row level security;
alter table public.duckzinha_knowledge enable row level security;
alter table public.duckzinha_expiring_messages enable row level security;
revoke all on table public.duckzinha_memory from anon, authenticated;
revoke all on table public.duckzinha_knowledge from anon, authenticated;
revoke all on table public.duckzinha_expiring_messages from anon, authenticated;
