-- Duckzinha RPG: tipos, TMs, loja e níveis.
-- Execute esta migração após criar duckzinha_wallets (sql/schema.sql e migração de moedas).
create table if not exists public.duckzinha_ducks(
 guild_id text not null,discord_user_id text not null,
 duck_type text not null default 'normal' check(duck_type in ('normal','agua','fogo','natureza','eletrico','gelo')),
 type_chosen boolean not null default false,
 level smallint not null default 1 check(level between 1 and 30),
 xp integer not null default 0 check(xp between 0 and 6000),
 moves text[] not null default array['bicada','asas_rapidas','quack']::text[],
 updated_at timestamptz not null default now(),
 primary key(guild_id,discord_user_id),
 constraint duck_moves_three check(coalesce(array_length(moves,1),0)=3)
);
create table if not exists public.duckzinha_duck_items(
 guild_id text not null,discord_user_id text not null,
 item_key text not null,quantity smallint not null default 0 check(quantity between 0 and 99),
 primary key(guild_id,discord_user_id,item_key)
);
create table if not exists public.duckzinha_duck_progress(
 guild_id text not null,discord_user_id text not null,event_key text not null,
 xp integer not null check(xp between 1 and 30),
 created_at timestamptz not null default now(),
 primary key(guild_id,discord_user_id,event_key)
);
create index if not exists duck_progress_daily on public.duckzinha_duck_progress(guild_id,discord_user_id,created_at);
do $$declare t text;begin
 foreach t in array array['duckzinha_ducks','duckzinha_duck_items','duckzinha_duck_progress'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end$$;

CREATE OR REPLACE FUNCTION public.duckzinha_battle_xp(p_guild text, p_user text, p_key text, p_xp integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pet public.duckzinha_ducks%rowtype;spent integer;inserted integer;
begin
 if p_xp not between 1 and 30 or length(p_key)>80 or p_key is null then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select coalesce(sum(xp),0) into spent from duckzinha_duck_progress
 where guild_id=p_guild and discord_user_id=p_user and created_at>=date_trunc('day',now());
 if spent+p_xp>100 then return jsonb_build_object('ok',false,'reason','daily');end if;
 insert into duckzinha_duck_progress(guild_id,discord_user_id,event_key,xp)
 values(p_guild,p_user,p_key,p_xp)on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return jsonb_build_object('ok',false,'reason','repeat');end if;
 insert into duckzinha_ducks(guild_id,discord_user_id)values(p_guild,p_user)on conflict do nothing;
 select * into pet from duckzinha_ducks where guild_id=p_guild and discord_user_id=p_user for update;
 pet.xp:=pet.xp+p_xp;
 while pet.level<30 and pet.xp>=30+pet.level*10 loop
 pet.xp:=pet.xp-(30+pet.level*10);pet.level:=pet.level+1;end loop;
 if pet.level=30 then pet.xp:=0;end if;
 update duckzinha_ducks set level=pet.level,xp=pet.xp,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'level',pet.level,'xp',pet.xp);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_buy_duck_item(p_guild text, p_user text, p_item text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare price integer;balance integer;amount integer;
begin
 price:=case p_item when 'racao' then 18 when 'super_racao' then 45
 when 'essencia' then 70 when 'tm_normal' then 70
 when 'tm_agua' then 75 when 'tm_fogo' then 75 when 'tm_eletrico' then 75
 when 'tm_natureza' then 75 when 'tm_gelo' then 75 else null end;
 if price is null then return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select coins into balance from duckzinha_wallets where guild_id=p_guild and discord_user_id=p_user for update;
 if coalesce(balance,0)<price then
 return jsonb_build_object('ok',false,'reason','coins','balance',coalesce(balance,0),'price',price);end if;
 select quantity into amount from duckzinha_duck_items
 where guild_id=p_guild and discord_user_id=p_user and item_key=p_item for update;
 if coalesce(amount,0)>=99 then return jsonb_build_object('ok',false,'reason','full');end if;
 update duckzinha_wallets set coins=coins-price,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 insert into duckzinha_duck_items(guild_id,discord_user_id,item_key,quantity)
 values(p_guild,p_user,p_item,1)
 on conflict(guild_id,discord_user_id,item_key)do update
 set quantity=duckzinha_duck_items.quantity+1;
 return jsonb_build_object('ok',true,'balance',balance-price,'item',p_item,'quantity',coalesce(amount,0)+1);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_choose_duck_type(p_guild text, p_user text, p_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pet public.duckzinha_ducks%rowtype;essence smallint;mov text;
begin
 if p_type not in ('normal','agua','fogo','natureza','eletrico','gelo') then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 insert into duckzinha_ducks(guild_id,discord_user_id)values(p_guild,p_user)on conflict do nothing;
 select * into pet from duckzinha_ducks where guild_id=p_guild and discord_user_id=p_user for update;
 if pet.duck_type=p_type and pet.type_chosen then
 return jsonb_build_object('ok',false,'reason','same');end if;
 if pet.type_chosen then
 select quantity into essence from duckzinha_duck_items
 where guild_id=p_guild and discord_user_id=p_user and item_key='essencia' for update;
 if coalesce(essence,0)<1 then return jsonb_build_object('ok',false,'reason','essencia');end if;
 update duckzinha_duck_items set quantity=quantity-1 where guild_id=p_guild and discord_user_id=p_user and item_key='essencia';
 end if;
 mov:=case p_type when 'agua' then 'jato' when 'fogo' then 'brasa'
 when 'natureza' then 'vinhas' when 'eletrico' then 'faisca'
 when 'gelo' then 'neve' else 'quack' end;
 update duckzinha_ducks set duck_type=p_type,type_chosen=true,
 moves=case when not pet.type_chosen then array['bicada','asas_rapidas',mov]::text[]
 else array_replace(pet.moves,case pet.duck_type when 'agua' then 'jato' when 'fogo' then 'brasa'
 when 'natureza' then 'vinhas' when 'eletrico' then 'faisca' when 'gelo' then 'neve'
 else 'quack' end,mov) end,
 updated_at=now() where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'type',p_type,'consumed',pet.type_chosen);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_feed_duck(p_guild text, p_user text, p_item text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare earned integer;have smallint;pet public.duckzinha_ducks%rowtype;gain integer;
begin
 earned:=case p_item when 'racao' then 50 when 'super_racao' then 140 else null end;
 if earned is null then return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select quantity into have from duckzinha_duck_items
 where guild_id=p_guild and discord_user_id=p_user and item_key=p_item for update;
 if coalesce(have,0)<1 then return jsonb_build_object('ok',false,'reason','missing');end if;
 insert into duckzinha_ducks(guild_id,discord_user_id)values(p_guild,p_user)on conflict do nothing;
 select * into pet from duckzinha_ducks where guild_id=p_guild and discord_user_id=p_user for update;
 if pet.level>=30 then return jsonb_build_object('ok',false,'reason','max');end if;
 update duckzinha_duck_items set quantity=quantity-1 where guild_id=p_guild and discord_user_id=p_user and item_key=p_item;
 pet.xp:=pet.xp+earned;
 while pet.level<30 and pet.xp >=30+pet.level*10 loop
 pet.xp:=pet.xp-(30+pet.level*10);pet.level:=pet.level+1;
 end loop;
 if pet.level=30 then pet.xp:=0;end if;
 update duckzinha_ducks set level=pet.level,xp=pet.xp,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'level',pet.level,'xp',pet.xp,'earned',earned);
end$function$;

CREATE OR REPLACE FUNCTION public.duckzinha_learn_duck_tm(p_guild text, p_user text, p_item text, p_slot integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pet public.duckzinha_ducks%rowtype;have smallint;move_name text;new_moves text[];
begin
 move_name:=case p_item when 'tm_agua' then 'tsunami'
 when 'tm_fogo' then 'furia' when 'tm_eletrico' then 'trovão'
 when 'tm_natureza' then 'floresta' when 'tm_gelo' then 'nevasca'
 when 'tm_normal' then 'cometa' else null end;
 if move_name is null or p_slot not between 1 and 3 then
 return jsonb_build_object('ok',false,'reason','invalid');end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select quantity into have from duckzinha_duck_items
 where guild_id=p_guild and discord_user_id=p_user and item_key=p_item for update;
 if coalesce(have,0)<1 then return jsonb_build_object('ok',false,'reason','missing');end if;
 insert into duckzinha_ducks(guild_id,discord_user_id)values(p_guild,p_user)on conflict do nothing;
 select * into pet from duckzinha_ducks where guild_id=p_guild and discord_user_id=p_user for update;
 new_moves:=pet.moves;
 if move_name=any(new_moves) then return jsonb_build_object('ok',false,'reason','already');end if;
 new_moves[p_slot]:=move_name;
 update duckzinha_duck_items set quantity=quantity-1 where guild_id=p_guild and discord_user_id=p_user and item_key=p_item;
 update duckzinha_ducks set moves=new_moves,updated_at=now()
 where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'moves',new_moves,'learned',move_name,'replaced',pet.moves[p_slot]);
end$function$;

do $$declare func text;begin
 foreach func in array array[
 'duckzinha_choose_duck_type(text,text,text)',
 'duckzinha_buy_duck_item(text,text,text)',
 'duckzinha_feed_duck(text,text,text)',
 'duckzinha_learn_duck_tm(text,text,text,integer)',
 'duckzinha_battle_xp(text,text,text,integer)'
 ] loop
 execute format('revoke all on function public.%s from public,anon,authenticated',func);
 execute format('grant execute on function public.%s to service_role',func);
 end loop;
end$$;
notify pgrst,'reload schema';
