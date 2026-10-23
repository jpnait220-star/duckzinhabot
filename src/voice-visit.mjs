import {
  joinVoiceChannel,entersState,VoiceConnectionStatus
} from '@discordjs/voice';
import {ChannelType,PermissionFlagsBits} from 'discord.js';

export const VOICE_IDLE_MS=5*60_000;
export function voiceMentionContext(message){
  const channel=message?.channel;
  if(!message?.inGuild?.()||channel?.type!==ChannelType.GuildVoice)return null;
  const member=message.member;
  if(!member?.voice?.channelId||member.voice.channelId!==channel.id)return null;
  const everyone=message.guild?.roles?.everyone;
  if(!everyone||!channel.permissionsFor(everyone)?.has(PermissionFlagsBits.ViewChannel))return null;
  if(channel.nsfw||/(?:staff|admin|modera|ticket|atendimento|suporte|denuncia|logs?)/i.test(channel.name||''))return null;
  return channel;
}
export function voiceIdleAt(lastMentionAt){return lastMentionAt+VOICE_IDLE_MS;}
export function voiceShouldLeave(lastMentionAt,now=Date.now()){
  return now>=voiceIdleAt(lastMentionAt);
}

export class DuckVoiceVisits{
  constructor({
    join=joinVoiceChannel,waitReady=entersState,now=Date.now,
    setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=VOICE_IDLE_MS
  }={}){
    this.sessions=new Map();
    this.join=join;
    this.waitReady=waitReady;
    this.now=now;
    this.setTimer=setTimer;
    this.clearTimer=clearTimer;
    this.timeoutMs=timeoutMs;
  }
  stop(guildId){
    const session=this.sessions.get(guildId);
    if(!session)return;
    this.sessions.delete(guildId);
    if(session.timer)this.clearTimer(session.timer);
    try{session.connection?.destroy?.();}catch{/* Already destroyed */}
  }
  schedule(session){
    if(session.timer)this.clearTimer(session.timer);
    const next=this.timeoutMs-(this.now()-session.lastMentionAt);
    session.timer=this.setTimer(()=>{
      if(this.sessions.get(session.guildId)!==session)return;
      if(this.now()-session.lastMentionAt>=this.timeoutMs)this.stop(session.guildId);
      else this.schedule(session);
    },Math.max(0,next));
    session.timer?.unref?.();
  }
  async mention(message){
    const channel=voiceMentionContext(message);
    if(!channel)return {ok:false,reason:'not-in-this-voice-chat'};
    const guildId=message.guildId;
    const me=message.guild.members.me||await message.guild.members.fetchMe();
    const perms=channel.permissionsFor(me);
    if(!perms?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect])){
      return {ok:false,reason:'missing-permissions'};
    }
    // Cada servidor permite só uma call por instância. Atualizar o prazo
    // somente quando alguém menciona Duckzinha no chat da call.
    const last=this.sessions.get(guildId);
    if(last?.channelId===channel.id && last.connection?.state?.status!==VoiceConnectionStatus.Destroyed){
      last.lastMentionAt=this.now();
      this.schedule(last);
      return {ok:true,joined:false,channelId:channel.id};
    }
    if(last)this.stop(guildId);
    let connection;
    try{
      connection=this.join({
        channelId:channel.id,guildId,
        adapterCreator:message.guild.voiceAdapterCreator,
        selfDeaf:true,selfMute:true
      });
      const session={guildId,channelId:channel.id,connection,lastMentionAt:this.now(),timer:null};
      this.sessions.set(guildId,session);
      this.schedule(session);
      await this.waitReady(connection,VoiceConnectionStatus.Ready,15000);
      if(this.sessions.get(guildId)!==session)return {ok:false,reason:'disconnected'};
      return {ok:true,joined:true,channelId:channel.id};
    }catch(error){
      this.stop(guildId);
      return {ok:false,reason:'join-failed',error:String(error?.message||error).slice(0,160)};
    }
  }
  onBotVoiceState(guildId,channelId){
    const session=this.sessions.get(guildId);
    if(session&&!channelId)this.stop(guildId);
  }
  shutdown(){for(const id of [...this.sessions.keys()])this.stop(id)}
}
