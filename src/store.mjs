import {createClient} from '@supabase/supabase-js';

export class DuckStore {
  constructor({url,serviceKey,guildId}) {
    this.guildId=guildId;
    this.db=url&&serviceKey ? createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
  }
  get persistent(){return Boolean(this.db)}
  async requireResult(query) {
    const {data,error}=await query;
    if(error)throw new Error('Banco da Duckzinha indisponível: '+error.message);
    return data;
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
    await this.requireResult(this.db.from('duckzinha_memory').update({preferred_name:name,updated_at:new Date().toISOString()})
      .eq('guild_id',this.guildId).eq('discord_user_id',discordId).eq('enabled',true));
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
