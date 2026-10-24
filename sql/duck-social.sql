-- DUCKZINHA • SOCIAL ECONOMY
-- Execute depois de sql/duck-economy.sql.
-- Esta migração já foi aplicada no Supabase conectado à Duckzinha.
-- Não requer ENV nova.
create table if not exists public.duckzinha_coin_transfers(
 guild_id text not null,sender_id text not null,receiver_id text not null,
 request_key text not null,amount integer not null check(amount between 1 and 500),
 created_at timestamptz not null default now(),
 primary key(guild_id,sender_id,request_key)
);
create index if not exists duckzinha_transfers_daily
 on public.duckzinha_coin_transfers(guild_id,sender_id,created_at);
create table if not exists public.duckzinha_daily_claims(
 guild_id text not null,user_id text not null,claim_day date not null,
 coins integer not null default 20 check(coins=20),
 claimed_at timestamptz not null default now(),
 primary key(guild_id,user_id,claim_day)
);
create table if not exists public.duckzinha_badge_catalog(
 guild_id text not null,badge_key text not null,
 label text not null check(char_length(label) between 2 and 40),
 price integer not null check(price between 1 and 100000),
 role_id text not null,
 created_at timestamptz not null default now(),
 primary key(guild_id,badge_key),
 constraint duck_badge_key_ok check(badge_key in ('bronze','prata','ouro','diamante'))
);
create table if not exists public.duckzinha_badge_owners(
 guild_id text not null,user_id text not null,badge_key text not null,
 price_paid integer not null check(price_paid between 1 and 100000),
 purchased_at timestamptz not null default now(),
 primary key(guild_id,user_id,badge_key)
);
do $$declare t text;begin
 foreach t in array array['duckzinha_coin_transfers','duckzinha_daily_claims',
   'duckzinha_badge_catalog','duckzinha_badge_owners'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end$$;

CREATE OR REPLACE FUNCTION public.duckzinha_claim_daily(p_guild text, p_user text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare today date;added integer;balance integer;
begin
 if p_guild !~ '^[0-9]{15,22}$' or p_user !~ '^[0-9]{15,22}$' then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 today:=(now() at time zone 'America/Bahia')::date;
 perform pg_advisory_xact_lock(hashtext('duckdaily:'||p_guild||':'||p_user));
 insert into duckzinha_daily_claims(guild_id,user_id,claim_day)
 values(p_guild,p_user,today) on conflict do nothing;
 get diagnostics added=row_count;
 if added=0 then
 return jsonb_build_object('ok',false,'reason','claimed','day',today);
 end if;
 insert into duckzinha_wallets(guild_id,discord_user_id,coins)
 values(p_guild,p_user,20)
 on conflict(guild_id,discord_user_id)do update set
 coins=least(1000000,duckzinha_wallets.coins+20),updated_at=now();
 select coins into balance from duckzinha_wallets
 where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'balance',balance,'earned',20,'day',today);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_purchase_badge(p_guild text, p_user text, p_badge text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare item public.duckzinha_badge_catalog%rowtype;balance integer;
begin
 if p_guild !~ '^[0-9]{15,22}$' or p_user !~ '^[0-9]{15,22}$' then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select * into item from duckzinha_badge_catalog
 where guild_id=p_guild and badge_key=p_badge;
 if not found then return jsonb_build_object('ok',false,'reason','missing');end if;
 if exists(select 1 from duckzinha_badge_owners where guild_id=p_guild
 and user_id=p_user and badge_key=p_badge) then
 return jsonb_build_object('ok',true,'already',true,'role_id',item.role_id,'label',item.label);end if;
 select coins into balance from duckzinha_wallets
 where guild_id=p_guild and discord_user_id=p_user for update;
 if coalesce(balance,0)<item.price then
 return jsonb_build_object('ok',false,'reason','funds','cost',item.price,'balance',coalesce(balance,0));end if;
 insert into duckzinha_badge_owners(guild_id,user_id,badge_key,price_paid)
 values(p_guild,p_user,p_badge,item.price);
 update duckzinha_wallets set coins=coins-item.price,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'already',false,'role_id',item.role_id,
  'label',item.label,'balance',balance-item.price);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_refund_badge(p_guild text, p_user text, p_badge text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cost integer;
begin
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 delete from duckzinha_badge_owners where guild_id=p_guild
 and user_id=p_user and badge_key=p_badge returning price_paid into cost;
 if cost is null then return false;end if;
 update duckzinha_wallets set coins=least(1000000,coins+cost),updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 return true;
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_transfer_coins(p_guild text, p_from text, p_to text, p_amount integer, p_request text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare funds integer; inserted integer; day_sum integer;
begin
 if p_guild !~ '^[0-9]{15,22}$' or p_from !~ '^[0-9]{15,22}$' or
 p_to !~ '^[0-9]{15,22}$' or p_from=p_to or p_amount not between 1 and 500 or
 length(p_request) not between 8 and 90 then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 -- A mesma chave por usuário impede transações duplicadas de interações repetidas.
 -- O lock no remetente impede saldo negativo por compras/transferências simultâneas.
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_from));
 if exists(select 1 from duckzinha_coin_transfers where guild_id=p_guild
  and sender_id=p_from and request_key=p_request) then
 return jsonb_build_object('ok',false,'reason','duplicate');end if;
 select coins into funds from duckzinha_wallets
 where guild_id=p_guild and discord_user_id=p_from for update;
 if coalesce(funds,0)<p_amount then
 return jsonb_build_object('ok',false,'reason','funds','balance',coalesce(funds,0));end if;
 select coalesce(sum(amount),0) into day_sum from duckzinha_coin_transfers
 where guild_id=p_guild and sender_id=p_from
 and created_at >=date_trunc('day',now() at time zone 'America/Bahia') at time zone 'America/Bahia';
 if day_sum+p_amount>1000 then
 return jsonb_build_object('ok',false,'reason','limit');end if;
 insert into duckzinha_coin_transfers(guild_id,sender_id,receiver_id,request_key,amount)
 values(p_guild,p_from,p_to,p_request,p_amount)on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return jsonb_build_object('ok',false,'reason','duplicate');end if;
 update duckzinha_wallets set coins=coins-p_amount,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_from;
 insert into duckzinha_wallets(guild_id,discord_user_id,coins)
 values(p_guild,p_to,p_amount)
 on conflict(guild_id,discord_user_id)do update set
 coins=least(1000000,duckzinha_wallets.coins+excluded.coins),updated_at=now();
 return jsonb_build_object('ok',true,'amount',p_amount,'balance',funds-p_amount);
end$function$;

revoke all on function public.duckzinha_claim_daily(text,text) from public,anon,authenticated;
revoke all on function public.duckzinha_transfer_coins(text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.duckzinha_purchase_badge(text,text,text) from public,anon,authenticated;
revoke all on function public.duckzinha_refund_badge(text,text,text) from public,anon,authenticated;
grant execute on function public.duckzinha_claim_daily(text,text) to service_role;
grant execute on function public.duckzinha_transfer_coins(text,text,text,integer,text) to service_role;
grant execute on function public.duckzinha_purchase_badge(text,text,text) to service_role;
grant execute on function public.duckzinha_refund_badge(text,text,text) to service_role;
notify pgrst,'reload schema';
