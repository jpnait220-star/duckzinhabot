-- Coinflip recreativo: até 5 partidas por participante a cada 2 horas.
-- 15 moedas de recompensa APENAS ao vencedor; sem aposta, entrada ou perda.
create table if not exists public.duckzinha_coinflip_entries(
 guild_id text not null,
 game_id text not null,
 user_id text not null,
 created_at timestamptz not null default now(),
 primary key (guild_id,game_id,user_id)
);
create index if not exists duck_coinflip_limit_idx
 on public.duckzinha_coinflip_entries(guild_id,user_id,created_at desc);
alter table public.duckzinha_coinflip_entries enable row level security;
revoke all on public.duckzinha_coinflip_entries from anon,authenticated;
grant select,insert,delete on public.duckzinha_coinflip_entries to service_role;

create or replace function public.duckzinha_coinflip_start(
 p_guild text,p_game text,p_host text,p_guest text
) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare n_host integer; n_guest integer;
begin
 if p_guild is null or p_game is null or p_host is null or p_guest is null
   or p_host=p_guest or length(p_guild) not between 17 and 22
   or length(p_game) not between 8 and 64
   or length(p_host) not between 17 and 22 or length(p_guest) not between 17 and 22
   then raise exception 'invalid coinflip participants';end if;
 -- Ordered locks also protect two simultaneous games with reversed hosts.
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||least(p_host,p_guest)));
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||greatest(p_host,p_guest)));
 if exists(select 1 from public.duckzinha_coinflip_entries
   where guild_id=p_guild and game_id=p_game)
   then return jsonb_build_object('ok',false,'reason','duplicate');end if;
 select count(*) into n_host from public.duckzinha_coinflip_entries
   where guild_id=p_guild and user_id=p_host and created_at>now()-interval '2 hours';
 select count(*) into n_guest from public.duckzinha_coinflip_entries
   where guild_id=p_guild and user_id=p_guest and created_at>now()-interval '2 hours';
 if n_host>=5 then return jsonb_build_object('ok',false,'reason','host_limit','used',n_host);end if;
 if n_guest>=5 then return jsonb_build_object('ok',false,'reason','guest_limit','used',n_guest);end if;
 insert into public.duckzinha_coinflip_entries(guild_id,game_id,user_id)
 values(p_guild,p_game,p_host),(p_guild,p_game,p_guest);
 return jsonb_build_object('ok',true,'host_used',n_host+1,'guest_used',n_guest+1);
end;
$$;

create or replace function public.duckzinha_coinflip_finish(
 p_guild text,p_game text,p_winner text
) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare inserted integer;balance integer;
begin
 if p_guild is null or p_game is null or p_winner is null
   then raise exception 'invalid coinflip reward';end if;
 if not exists(select 1 from public.duckzinha_coinflip_entries
   where guild_id=p_guild and game_id=p_game and user_id=p_winner)
   then return jsonb_build_object('ok',false,'reason','participant');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_winner));
 insert into public.duckzinha_coin_events(guild_id,discord_user_id,event_key,reward_kind,coins)
 values(p_guild,p_winner,'coinflip:'||p_game,'coinflip',15)
 on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
   insert into public.duckzinha_wallets(guild_id,discord_user_id,coins)
     values(p_guild,p_winner,15)
   on conflict(guild_id,discord_user_id) do update
     set coins=least(1000000,public.duckzinha_wallets.coins+15),updated_at=now();
 end if;
 select coins into balance from public.duckzinha_wallets
   where guild_id=p_guild and discord_user_id=p_winner;
 return jsonb_build_object('ok',true,'credited',inserted=1,'balance',coalesce(balance,0));
end;
$$;
revoke all on function public.duckzinha_coinflip_start(text,text,text,text) from public,anon,authenticated;
revoke all on function public.duckzinha_coinflip_finish(text,text,text) from public,anon,authenticated;
grant execute on function public.duckzinha_coinflip_start(text,text,text,text) to service_role;
grant execute on function public.duckzinha_coinflip_finish(text,text,text) to service_role;
notify pgrst,'reload schema';
