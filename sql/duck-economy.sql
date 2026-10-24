-- Moedas de pato, AFK e inventário de cosméticos.
-- Aplique esta migração antes de sql/duck-rpg.sql.
create table if not exists public.duckzinha_wallets(
 guild_id text not null,discord_user_id text not null,
 coins integer not null default 0 check(coins between 0 and 1000000),
 updated_at timestamptz not null default now(),
 primary key(guild_id,discord_user_id)
);
create table if not exists public.duckzinha_coin_events(
 guild_id text not null,discord_user_id text not null,event_key text not null,
 reward_kind text not null,coins integer not null check(coins between 1 and 20),
 created_at timestamptz not null default now(),
 primary key(guild_id,discord_user_id,event_key)
);
create index if not exists duck_coins_time on public.duckzinha_coin_events(guild_id,discord_user_id,reward_kind,created_at);
create table if not exists public.duckzinha_afk(
 guild_id text not null,discord_user_id text not null,
 started_at timestamptz,claimed_at timestamptz,
 primary key(guild_id,discord_user_id)
);
create table if not exists public.duckzinha_loadouts(
 guild_id text not null,discord_user_id text not null,
 slot smallint not null check(slot between 1 and 5),
 avatar jsonb not null,updated_at timestamptz not null default now(),
 primary key(guild_id,discord_user_id,slot),
 constraint duck_loadout_object check(jsonb_typeof(avatar)='object' and pg_column_size(avatar)<2048)
);
do $$declare n text;begin
 foreach n in array array['duckzinha_wallets','duckzinha_coin_events','duckzinha_afk','duckzinha_loadouts'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon,authenticated',n);
 execute format('grant select,insert,update,delete on public.%I to service_role',n);
 end loop;
end$$;

CREATE OR REPLACE FUNCTION public.duckzinha_award_coins(p_guild text, p_user text, p_key text, p_kind text, p_coins integer, p_daily_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare current_total integer; existing integer;sum_today integer;
begin
 if p_guild is null or p_user is null or length(p_key)>120 or length(p_key)<3
 or p_coins not between 1 and 20 or p_daily_limit not between 1 and 100
 or p_kind not in ('conversa','ensino','afk') then raise exception 'invalid reward';end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select coins into existing from duckzinha_wallets where guild_id=p_guild and discord_user_id=p_user;
 select coalesce(sum(coins),0) into sum_today from duckzinha_coin_events
 where guild_id=p_guild and discord_user_id=p_user and reward_kind=p_kind
 and created_at>=date_trunc('day',now());
 if sum_today+p_coins<=p_daily_limit then
   insert into duckzinha_coin_events(guild_id,discord_user_id,event_key,reward_kind,coins)
   values(p_guild,p_user,p_key,p_kind,p_coins) on conflict do nothing;
   if found then
    insert into duckzinha_wallets(guild_id,discord_user_id,coins)
    values(p_guild,p_user,p_coins)
    on conflict(guild_id,discord_user_id)do update
    set coins=least(1000000,duckzinha_wallets.coins+excluded.coins),updated_at=now();
   end if;
 end if;
 select coins into current_total from duckzinha_wallets where guild_id=p_guild and discord_user_id=p_user;
 return coalesce(current_total,0);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_claim_afk(p_guild text, p_user text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare started timestamptz;coins_now integer;
begin
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select started_at into started from duckzinha_afk where guild_id=p_guild and discord_user_id=p_user for update;
 if started is null then return jsonb_build_object('ok',false,'reason','none');end if;
 if started>now()-interval '10 minutes' then return jsonb_build_object('ok',false,'reason','early');end if;
 update duckzinha_afk set started_at=null,claimed_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 coins_now:=public.duckzinha_award_coins(p_guild,p_user,'afk:'||extract(epoch from started)::bigint,'afk',5,20);
 return jsonb_build_object('ok',true,'balance',coins_now);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_start_afk(p_guild text, p_user text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare previous timestamptz;last_reward timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select started_at,claimed_at into previous,last_reward from duckzinha_afk where guild_id=p_guild and discord_user_id=p_user;
 if previous is not null then return false;end if;
 if last_reward is not null and last_reward>now()-interval '30 minutes' then return false;end if;
 insert into duckzinha_afk(guild_id,discord_user_id,started_at)values(p_guild,p_user,now())
 on conflict(guild_id,discord_user_id)do update set started_at=now();
 return true;
end$function$;

revoke all on function public.duckzinha_award_coins(text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.duckzinha_award_coins(text,text,text,text,integer,integer) to service_role;
revoke all on function public.duckzinha_start_afk(text,text) from public,anon,authenticated;
revoke all on function public.duckzinha_claim_afk(text,text) from public,anon,authenticated;
grant execute on function public.duckzinha_start_afk(text,text) to service_role;
grant execute on function public.duckzinha_claim_afk(text,text) to service_role;
notify pgrst,'reload schema';
