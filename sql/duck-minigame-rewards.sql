-- Recompensa de minigames concluídos: +5 moedas ao vencedor.
-- O event_key é único por partida/rodada e evita pagamentos duplicados.
-- Apenas o serviço da Duckzinha (service_role) pode executar a função.
create or replace function public.duckzinha_reward_minigame(
 p_guild text,p_user text,p_key text
) returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare inserted integer; wallet_balance integer;
begin
 if p_guild is null or p_guild !~ '^[0-9]{17,22}$'
    or p_user is null or p_user !~ '^[0-9]{17,22}$'
    or p_key is null or p_key !~ '^minigame:(mini|rps|ttt|quiz):[a-zA-Z0-9_-]{8,64}$'
    or length(p_key)>120 then
   raise exception 'invalid minigame reward';
 end if;
 perform pg_advisory_xact_lock(hashtext(p_guild||':'||p_user));
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
 return jsonb_build_object(
   'ok',true,'credited',inserted=1,'balance',coalesce(wallet_balance,0)
 );
end;
$$;
revoke all on function public.duckzinha_reward_minigame(text,text,text)
 from public,anon,authenticated;
grant execute on function public.duckzinha_reward_minigame(text,text,text)
 to service_role;
notify pgrst,'reload schema';
