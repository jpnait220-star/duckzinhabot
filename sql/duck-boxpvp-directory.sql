-- Catálogo de servidores BoxPvP aprovado exclusivamente pela moderação.
create table if not exists public.duckzinha_boxpvp_servers (
 id bigint generated always as identity primary key,
 guild_id text not null check (guild_id ~ '^[0-9]{17,22}$'),
 server_name varchar(56) not null,
 server_ip varchar(253) not null,
 created_at timestamptz not null default now(),
 unique (guild_id, server_ip)
);
create index if not exists duckzinha_boxpvp_servers_guild_idx
 on public.duckzinha_boxpvp_servers(guild_id,created_at desc);
alter table public.duckzinha_boxpvp_servers enable row level security;
revoke all on public.duckzinha_boxpvp_servers from public,anon,authenticated;
revoke all on sequence public.duckzinha_boxpvp_servers_id_seq from public,anon,authenticated;
grant select,insert,delete on public.duckzinha_boxpvp_servers to service_role;
grant usage,select on sequence public.duckzinha_boxpvp_servers_id_seq to service_role;
notify pgrst,'reload schema';
