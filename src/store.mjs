import {createClient} from '@supabase/supabase-js';
import {adjustedAffinity,nextAffinity} from './affinity.mjs';
import {DEFAULT_VOICE,validVoice} from './duck-tts.mjs';
import {HISTORY_WINDOW} from './duck-chat-history.mjs';

export class DuckStore {
  constructor({url,serviceKey,guildId}) {
    this.guildId=guildId;
    this.db=url&&serviceKey ? createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
  }
  get persistent(){return Boolean(this.db)}
  async requireResult(query) {
    // Never let a stalled Supabase request lock the Discord message handler forever.
    // The request may continue in the background, but the bot can reply again.
    let timeoutId;
    const deadline=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(new Error('Supabase demorou mais de 8 segundos')),8000);
    });
    try{
      const {data,error}=await Promise.race([Promise.resolve(query),deadline]);
      if(error)throw new Error('Banco da Duckzinha indisponível: '+error.message);
      return data;
    }finally{
      clearTimeout(timeoutId);
    }
  }
  async getSharedContext() {
    if(!this.db)return [];
    const row=await this.requireResult(this.db.from('duckzinha_server_context').select('messages')
      .eq('guild_id',this.guildId).maybeSingle());
    return Array.isArray(row?.messages)?row.messages:[];
  }
  async saveSharedContext(messages) {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_server_context')
      .upsert({guild_id:this.guildId,messages:messages.slice(-80),updated_at:new Date().toISOString()},
        {onConflict:'guild_id'}));
  }
  async getConversation(discordId) {
    if(!this.db)return [];
    const row=await this.requireResult(this.db.from('duckzinha_conversations')
      .select('history,expires_at').eq('guild_id',this.guildId)
      .eq('discord_user_id',discordId).maybeSingle());
    if(!row||Date.parse(row.expires_at)<=Date.now())return [];
    return Array.isArray(row.history)?row.history.slice(-HISTORY_WINDOW)
      .filter(item=>['user','assistant'].includes(item?.role)&&typeof item.content==='string')
      .map(item=>({role:item.role,content:item.content.slice(0,850)})):[];
  }
  async saveConversation(discordId,items) {
    if(!this.db)return;
    const history=items.slice(-HISTORY_WINDOW).filter(item=>['user','assistant'].includes(item?.role)&&typeof item.content==='string')
      .map(item=>({role:item.role,content:item.content.slice(0,850)}));
    await this.requireResult(this.db.from('duckzinha_conversations').upsert({
      guild_id:this.guildId,discord_user_id:discordId,history,
      updated_at:new Date().toISOString(),
      expires_at:new Date(Date.now()+14*86400000).toISOString()
    },{onConflict:'guild_id,discord_user_id'}));
  }
  async deleteFamiliarity(discordId) {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_familiarity').delete()
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId));
  }
  async forgetSelf(discordId) {
    if(!this.db)throw Error('Supabase não configurado.');
    await this.requireResult(this.db.from('duckzinha_conversations').delete()
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId));
    await this.requireResult(this.db.from('duckzinha_memory').delete()
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId));
    await this.deleteFamiliarity(discordId);
    await this.requireResult(this.db.from('duckzinha_avatars').delete()
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId)).catch(err=>
        console.warn('[Duckzinha] Avatar: '+err.message));
    for(const table of ['duckzinha_wallets','duckzinha_coin_events','duckzinha_afk','duckzinha_loadouts','duckzinha_ducks','duckzinha_duck_items','duckzinha_duck_progress','duckzinha_coin_transfers','duckzinha_daily_claims','duckzinha_badge_owners'])
      await this.requireResult(this.db.from(table).delete().eq('guild_id',this.guildId)
        .eq('discord_user_id',discordId)).catch(err=>console.warn('[Duckzinha] Privacidade: '+err.message));
    await this.requireResult(this.db.from('duckzinha_profile_facts').delete()
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId)).catch(err=>
      console.warn('[Duckzinha] Fatos pessoais: '+err.message));
  }
  async resetMemory() {
    if(!this.db)throw Error('Supabase não configurado.');
    await this.requireResult(this.db.from('duckzinha_conversations').delete().eq('guild_id',this.guildId));
    await this.requireResult(this.db.from('duckzinha_memory').delete().eq('guild_id',this.guildId));
    await this.requireResult(this.db.from('duckzinha_familiarity').delete()
      .eq('guild_id',this.guildId));
    await this.requireResult(this.db.from('duckzinha_profile_facts').delete()
      .eq('guild_id',this.guildId)).catch(err=>
      console.warn('[Duckzinha] Resetar preferências: '+err.message));
    await this.requireResult(this.db.from('duckzinha_avatars').delete()
      .eq('guild_id',this.guildId)).catch(err=>
      console.warn('[Duckzinha] Resetar avatares: '+err.message));
  }
  async cleanupConversations() {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_conversations').delete()
      .eq('guild_id',this.guildId).lt('expires_at',new Date().toISOString()));
  }
  async getPersonalityPrompt() {
    if(!this.db)return '';
    const row=await this.requireResult(this.db.from('duckzinha_config')
      .select('personality_prompt').eq('guild_id',this.guildId).maybeSingle());
    return typeof row?.personality_prompt==='string'?row.personality_prompt:'';
  }
  async setPersonalityPrompt(prompt,adminId) {
    if(!this.db)throw Error('Supabase não configurado.');
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw Error('O prompt deve conter até 8000 caracteres.');
    await this.requireResult(this.db.from('duckzinha_config').upsert({
      guild_id:this.guildId,personality_prompt:prompt.trim(),updated_by:adminId,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id'}));
  }
  async getVoice(){
    if(!this.db)return DEFAULT_VOICE;
    const row=await this.requireResult(this.db.from('duckzinha_config')
      .select('voice_name').eq('guild_id',this.guildId).maybeSingle());
    return validVoice(row?.voice_name)?row.voice_name:DEFAULT_VOICE;
  }
  async setVoice(voiceName,adminId){
    if(!validVoice(voiceName))throw Error('A voz precisa ser uma das opções pt-BR permitidas.');
    if(!this.db)throw Error('O Supabase precisa estar configurado para salvar a voz.');
    await this.requireResult(this.db.from('duckzinha_config').upsert({
      guild_id:this.guildId,voice_name:voiceName,updated_by:adminId,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id'}));
    return voiceName;
  }
  async getFeatureSettings(){
    if(!this.db)return {};
    const row=await this.requireResult(this.db.from('duckzinha_config')
      .select('features').eq('guild_id',this.guildId).maybeSingle());
    return row?.features||{};
  }
  async setFeatureSettings(features,adminId){
    if(!this.db)throw Error('Supabase não configurado.');
    await this.requireResult(this.db.from('duckzinha_config').upsert({
      guild_id:this.guildId,features,updated_by:adminId,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id'}));
  }
  async claimDaily(user){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.rpc('duckzinha_claim_daily',{
      p_guild:this.guildId,p_user:user
    }));
  }
  async transferCoins(from,to,amount,requestId){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.rpc('duckzinha_transfer_coins',{
      p_guild:this.guildId,p_from:from,p_to:to,
      p_amount:amount,p_request:requestId
    }));
  }
  async setBadge({key,label,price,roleId}){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.from('duckzinha_badge_catalog').upsert({
      guild_id:this.guildId,badge_key:key,label,price,role_id:roleId
    },{onConflict:'guild_id,badge_key'}));
  }
  async listBadges(){
    if(!this.db)return [];
    return this.requireResult(this.db.from('duckzinha_badge_catalog')
      .select('badge_key,label,price,role_id').eq('guild_id',this.guildId)
      .order('price',{ascending:true}));
  }
  async removeBadge(key){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.from('duckzinha_badge_catalog')
      .delete().eq('guild_id',this.guildId).eq('badge_key',key));
  }
  async buyBadge(user,key){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.rpc('duckzinha_purchase_badge',{
      p_guild:this.guildId,p_user:user,p_badge:key
    }));
  }
  async refundBadge(user,key){
    if(!this.db)throw Error('Supabase indisponível.');
    return this.requireResult(this.db.rpc('duckzinha_refund_badge',{
      p_guild:this.guildId,p_user:user,p_badge:key
    }));
  }
  async getBalance(user){
    if(!this.db)return 0;
    const row=await this.requireResult(this.db.from('duckzinha_wallets').select('coins')
      .eq('guild_id',this.guildId).eq('discord_user_id',user).maybeSingle());
    return Number(row?.coins)||0;
  }
  async awardCoins(user,key,kind,amount,limit){
    if(!this.db)return 0;
    return await this.requireResult(this.db.rpc('duckzinha_award_coins',{
      p_guild:this.guildId,p_user:user,p_key:key,p_kind:kind,p_coins:amount,p_daily_limit:limit
    }));
  }
  async rewardMinigame(user,gameKey){
    if(!this.db)return {ok:false,reason:'database'};
    return this.requireResult(this.db.rpc('duckzinha_reward_minigame',{
      p_guild:this.guildId,p_user:user,p_key:'minigame:'+gameKey
    }));
  }
  async startCoinflip(gameId,host,guest){
    if(!this.db)return {ok:false,reason:'database'};
    return this.requireResult(this.db.rpc('duckzinha_coinflip_start',{
      p_guild:this.guildId,p_game:gameId,p_host:host,p_guest:guest
    }));
  }
  async finishCoinflip(gameId,winner){
    if(!this.db)return {ok:false,reason:'database'};
    return this.requireResult(this.db.rpc('duckzinha_coinflip_finish',{
      p_guild:this.guildId,p_game:gameId,p_winner:winner
    }));
  }
  async startAfk(user){
    if(!this.db)return false;
    return await this.requireResult(this.db.rpc('duckzinha_start_afk',{p_guild:this.guildId,p_user:user}));
  }
  async claimAfk(user){
    if(!this.db)return {ok:false,reason:'none'};
    return await this.requireResult(this.db.rpc('duckzinha_claim_afk',{p_guild:this.guildId,p_user:user}));
  }
  async getLoadouts(user){
    if(!this.db)return [];
    return await this.requireResult(this.db.from('duckzinha_loadouts')
      .select('slot,avatar').eq('guild_id',this.guildId).eq('discord_user_id',user).order('slot'))||[];
  }
  async saveLoadout(user,slot,avatar){
    if(!this.db)throw Error('Supabase indisponível.');
    if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('Slot inválido.');
    await this.requireResult(this.db.from('duckzinha_loadouts').upsert({
      guild_id:this.guildId,discord_user_id:user,slot,avatar,updated_at:new Date().toISOString()
    },{onConflict:'guild_id,discord_user_id,slot'}));
  }
  async getAvatar(discordId){
    if(!this.db)return null;
    const row=await this.requireResult(this.db.from('duckzinha_avatars')
      .select('avatar').eq('guild_id',this.guildId)
      .eq('discord_user_id',discordId).maybeSingle());
    return row?.avatar||null;
  }
  async setAvatar(discordId,avatar){
    if(!this.db)throw Error('Supabase não configurado.');
    await this.requireResult(this.db.from('duckzinha_avatars').upsert({
      guild_id:this.guildId,discord_user_id:discordId,avatar,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id,discord_user_id'}));
  }
  async addProjectUpdate(title,description,authorId){
    if(!this.db)throw Error('Supabase não configurado.');
    await this.requireResult(this.db.from('duckzinha_project_updates').insert({
      guild_id:this.guildId,title:title.slice(0,80),
      description:description.slice(0,1800),author_id:authorId
    }));
  }
  async listProjectUpdates(){
    if(!this.db)return [];
    const rows=await this.requireResult(this.db.from('duckzinha_project_updates')
      .select('title,description,created_at').eq('guild_id',this.guildId)
      .order('created_at',{ascending:false}).limit(5));
    return rows||[];
  }
  async getProfileFacts(discordId) {
    if(!this.db)return [];
    const rows=await this.requireResult(this.db.from('duckzinha_profile_facts')
      .select('fact_key,fact_value').eq('guild_id',this.guildId)
      .eq('discord_user_id',discordId).order('updated_at',{ascending:false}).limit(8));
    return rows||[];
  }
  async saveProfileFact(discordId,key,value) {
    if(!this.db)throw Error('Banco não configurado.');
    await this.requireResult(this.db.from('duckzinha_profile_facts').upsert({
      guild_id:this.guildId,discord_user_id:discordId,fact_key:key,fact_value:value,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id,discord_user_id,fact_key'}));
  }
  async getSocialState(discordId) {
    if(!this.db)return {turns:0,score:0};
    const row=await this.requireResult(this.db.from('duckzinha_familiarity')
      .select('turns_count,affinity_score,affinity_updated_at')
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId).maybeSingle());
    return {turns:Math.max(0,Number(row?.turns_count)||0),
      score:adjustedAffinity(row?.affinity_score,row?.affinity_updated_at)};
  }
  async getFamiliarity(discordId){
    return (await this.getSocialState(discordId)).turns;
  }
  async incrementFamiliarity(discordId,{toneChange=0,score=0}={}) {
    if(!this.db)return 0;
    const current=await this.getFamiliarity(discordId);
    const next=Math.min(100000,current+1);
    const fields={
      guild_id:this.guildId,discord_user_id:discordId,
      turns_count:next,last_interaction_at:new Date().toISOString()
    };
    if(toneChange!==0){
      fields.affinity_score=nextAffinity(score,0);
      fields.affinity_updated_at=new Date().toISOString();
    }
    await this.requireResult(this.db.from('duckzinha_familiarity').upsert(
      fields,{onConflict:'guild_id,discord_user_id'}));
    return next;
  }
  async getMember(discordId) {
    if(!this.db)return null;
    return await this.requireResult(this.db.from('duckzinha_memory').select('enabled,preferred_name')
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId).maybeSingle());
  }
  async setMemoryEnabled(discordId,enabled) {
    if(!this.db)throw Error('Memória persistente ainda não configurada.');
    await this.requireResult(this.db.from('duckzinha_memory').upsert({guild_id:this.guildId,discord_user_id:discordId,enabled,preferred_name:null,updated_at:new Date().toISOString()},{onConflict:'guild_id,discord_user_id'}));
  }
  async rememberName(discordId,name) {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_memory').upsert({
      guild_id:this.guildId,discord_user_id:discordId,enabled:true,preferred_name:name,
      updated_at:new Date().toISOString()
    },{onConflict:'guild_id,discord_user_id'}));
  }
  async forget(discordId) {
    if(!this.db)throw Error('Memória persistente ainda não configurada.');
    await this.requireResult(this.db.from('duckzinha_memory').delete().eq('guild_id',this.guildId).eq('discord_user_id',discordId));
  }
  async loadKnowledge(){
    if(!this.db)return [];
    return await this.requireResult(this.db.from('duckzinha_knowledge').select('topic,answer')
      .eq('guild_id',this.guildId).order('topic'))||[];
  }
  async teach(topic,answer) {
    if(!this.db)throw Error('Ensinos permanentes exigem Supabase.');
    await this.requireResult(this.db.from('duckzinha_knowledge').upsert({guild_id:this.guildId,topic,answer,updated_at:new Date().toISOString()},{onConflict:'guild_id,topic'}));
  }
  async unteach(topic) {
    if(!this.db)throw Error('Ensinos permanentes exigem Supabase.');
    await this.requireResult(this.db.from('duckzinha_knowledge').delete().eq('guild_id',this.guildId).eq('topic',topic));
  }
  async registerMessage({messageId,channelId,expiresAt}) {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_expiring_messages').upsert({message_id:messageId,guild_id:this.guildId,channel_id:channelId,expires_at:new Date(expiresAt).toISOString()},{onConflict:'message_id'}));
  }
  async removeMessage(messageId) {
    if(!this.db)return;
    await this.requireResult(this.db.from('duckzinha_expiring_messages').delete().eq('message_id',messageId));
  }
  async getExpiredMessages(limit=75) {
    if(!this.db)return [];
    return await this.requireResult(this.db.from('duckzinha_expiring_messages').select('message_id,channel_id')
      .eq('guild_id',this.guildId).lte('expires_at',new Date().toISOString()).order('expires_at',{ascending:true}).limit(limit))||[];
  }
}
