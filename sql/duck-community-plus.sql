-- Duckzinha: lembretes, sugestões e eventos, sem novas ENVs.
-- Execute no SQL Editor do Supabase após sql/schema.sql.
create table if not exists public.duckzinha_reminders(
 id bigint generated always as identity primary key,
 guild_id text not null,
 user_id text not null,
 text text not null check(length(text) between 1 and 180),
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sent','cancelled','failed')),
 created_at timestamptz not null default now()
);
create index if not exists duck_reminder_due
 on public.duckzinha_reminders(guild_id,status,due_at);

create table if not exists public.duckzinha_suggestions(
 id bigint generated always as identity primary key,
 guild_id text not null,
 author_id text not null,
 channel_id text not null,
 message_id text,
 text text not null check(length(text) between 8 and 400),
 status text not null default 'open' check(status in ('open','approved','rejected','cancelled')),
 created_at timestamptz not null default now()
);
create index if not exists duck_suggestions_open on public.duckzinha_suggestions(guild_id,status);
create table if not exists public.duckzinha_suggestion_votes(
 suggestion_id bigint not null references public.duckzinha_suggestions(id) on delete cascade,
 user_id text not null,
 created_at timestamptz not null default now(),
 primary key(suggestion_id,user_id)
);

create table if not exists public.duckzinha_events(
 id bigint generated always as identity primary key,
 guild_id text not null,
 creator_id text not null,
 channel_id text not null,
 message_id text,
 title text not null check(length(title) between 3 and 90),
 description text not null default '' check(length(description)<=400),
 starts_at timestamptz not null,
 status text not null default 'open' check(status in ('open','cancelled','finished')),
 announced_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists duck_events_due on public.duckzinha_events(guild_id,status,starts_at);
create table if not exists public.duckzinha_event_attendees(
 event_id bigint not null references public.duckzinha_events(id) on delete cascade,
 user_id text not null,
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);

do $$
declare table_name text;
begin
 foreach table_name in array array[
   'duckzinha_reminders','duckzinha_suggestions','duckzinha_suggestion_votes',
   'duckzinha_events','duckzinha_event_attendees'
 ] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon,authenticated',table_name);
  execute format('grant select,insert,update,delete on public.%I to service_role',table_name);
 end loop;
end$$;
grant usage,select on sequence public.duckzinha_reminders_id_seq to service_role;
grant usage,select on sequence public.duckzinha_suggestions_id_seq to service_role;
grant usage,select on sequence public.duckzinha_events_id_seq to service_role;
notify pgrst,'reload schema';
