-- Máximo de 5 vitórias premiadas no Jogo da Velha por jogador a cada 2 horas.
-- Outras modalidades mantêm +5 moedas por vitória/acerto.
create or replace function public.duckzinha_reward_minigame(
 p_guild text,p_user text,p_key text
) returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare inserted integer; wallet_balance integer; wins_recent integer;
begin
 if p_guild is null or p_guild !~ '^[0-9]{17,22}$'
    or p_user is null or p_user !~ '^[0-9]{17,22}$'
    or p_key is null or p_key !~ '^minigame:(mini|rps|ttt|quiz):[a-zA-Z0-9_-]{8,64}$'
    or length(p_key)>120 then
   raise exception 'invalid minigame reward';
 end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
 select coins into wallet_balance from public.duckzinha_wallets
  where guild_id=p_guild and discord_user_id=p_user;
 if exists(select 1 from public.duckzinha_coin_events
   where guild_id=p_guild and discord_user_id=p_user and event_key=p_key)
 then
   return jsonb_build_object('ok',true,'credited',false,'reason','duplicate',
     'balance',coalesce(wallet_balance,0));
 end if;
 if p_key like 'minigame:ttt:%' then
   select count(*) into wins_recent from public.duckzinha_coin_events
     where guild_id=p_guild and discord_user_id=p_user
       and event_key like 'minigame:ttt:%'
       and created_at>now()-interval '2 hours';
   if wins_recent>=5 then
     return jsonb_build_object('ok',true,'credited',false,'reason','reward_limit',
       'balance',coalesce(wallet_balance,0),'limit',5);
   end if;
 end if;
 insert into public.duckzinha_coin_events
  (guild_id,discord_user_id,event_key,reward_kind,coins)
 values(p_guild,p_user,p_key,'minigame',5)
 on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
   insert into public.duckzinha_wallets
     (guild_id,discord_user_id,coins)
   values(p_guild,p_user,5)
   on conflict(guild_id,discord_user_id) do update
     set coins=least(1000000,public.duckzinha_wallets.coins+5),updated_at=now();
 end if;
 select coins into wallet_balance from public.duckzinha_wallets
  where guild_id=p_guild and discord_user_id=p_user;
 return jsonb_build_object('ok',true,'credited',inserted=1,
   'balance',coalesce(wallet_balance,0));
end;
$$;
revoke all on function public.duckzinha_reward_minigame(text,text,text)
 from public,anon,authenticated;
grant execute on function public.duckzinha_reward_minigame(text,text,text)
 to service_role;
notify pgrst,'reload schema';
