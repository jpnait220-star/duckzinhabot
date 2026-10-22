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

-- Memória curta entre reinicializações: até 12 mensagens por usuário, 14 dias.
create table if not exists public.duckzinha_conversations (
  guild_id text not null,
  discord_user_id text not null,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '14 days'),
  primary key (guild_id,discord_user_id),
  constraint duckzinha_conversation_history_array check (jsonb_typeof(history)='array' and jsonb_array_length(history)<=12)
);
create index if not exists duckzinha_conversations_expires_idx on public.duckzinha_conversations(expires_at);
alter table public.duckzinha_conversations enable row level security;
revoke all on public.duckzinha_conversations from anon,authenticated;
grant select,insert,update,delete on public.duckzinha_conversations to service_role;

-- Personalidade enviada em arquivo TXT pelo comando /configurar.
create table if not exists public.duckzinha_config (
  guild_id text primary key,
  personality_prompt text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint duckzinha_config_prompt_length check (char_length(personality_prompt)<=8000)
);
alter table public.duckzinha_config enable row level security;
revoke all on public.duckzinha_config from anon,authenticated;
grant select,insert,update,delete on public.duckzinha_config to service_role;
notify pgrst, 'reload schema';


-- Memórias voluntárias de interesses declarados pelos próprios membros.
-- Persistem até exclusão pelo usuário, sem coletar conversas completas.
create table if not exists public.duckzinha_profile_facts (
  guild_id text not null,
  discord_user_id text not null,
  fact_key text not null,
  fact_value text not null,
  updated_at timestamptz not null default now(),
  primary key (guild_id,discord_user_id,fact_key),
  constraint duckzinha_profile_key_length check (length(fact_key) between 2 and 60),
  constraint duckzinha_profile_value_length check (length(fact_value) between 1 and 160)
);
create index if not exists duckzinha_profile_facts_user_idx
  on public.duckzinha_profile_facts(guild_id,discord_user_id);
alter table public.duckzinha_profile_facts enable row level security;
revoke all on public.duckzinha_profile_facts from anon,authenticated;
grant select,insert,update,delete on public.duckzinha_profile_facts to service_role;
notify pgrst, 'reload schema';
