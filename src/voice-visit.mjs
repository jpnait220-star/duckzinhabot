import {Readable} from 'node:stream';
import {
  joinVoiceChannel,entersState,VoiceConnectionStatus,createAudioPlayer,createAudioResource,
  StreamType,AudioPlayerStatus,NoSubscriberBehavior
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
    try{session.player?.stop?.(true);}catch{/* Player já parou */}
    try{session.subscription?.unsubscribe?.();}catch{/* Sem assinatura */}
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
    if(!perms?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak])){
      return {ok:false,reason:'missing-permissions'};
    }
    // Cada servidor permite só uma call por instância. Atualizar o prazo
    // somente quando alguém menciona Duckzinha no chat da call.
    const last=this.sessions.get(guildId);
    if(last?.channelId===channel.id && last.connection?.state?.status===VoiceConnectionStatus.Ready){
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
        selfDeaf:true,selfMute:false
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
  async speak(guildId,audio){
    const session=this.sessions.get(guildId);
    if(!session)throw Error('Duckzinha não está conectada à call');
    if(!Buffer.isBuffer(audio)||audio.length<24)throw Error('Arquivo TTS inválido');
    if(session.connection?.state?.status!==VoiceConnectionStatus.Ready){
      try{
        await this.waitReady(session.connection,VoiceConnectionStatus.Ready,10000);
      }catch(error){
        throw Error('Conexão de voz não ficou pronta ('+
          String(session.connection?.state?.status||'desconhecido')+'): '+
          String(error?.message||error).slice(0,100));
      }
    }
    if(this.sessions.get(guildId)!==session)throw Error('A call mudou antes da fala');
    // Nunca iniciar múltiplas falas ao mesmo tempo.
    if((session.pendingSpeech||0)>=2)throw Error('Fila de fala cheia');
    session.pendingSpeech=(session.pendingSpeech||0)+1;
    const previous=session.speechQueue||Promise.resolve();
    const next=previous.catch(()=>{}).then(async()=>{
      if(this.sessions.get(guildId)!==session)throw Error('A call mudou antes de reproduzir');
      if(!session.player){
        session.player=createAudioPlayer({
          behaviors:{noSubscriber:NoSubscriberBehavior.Pause}
        });
        session.subscription=session.connection.subscribe(session.player);
        if(!session.subscription)throw Error('O Discord não assinou o player de áudio na call');
        session.player.on('error',error=>{
          console.warn('[Duckzinha] Player de voz: '+String(error?.message||error));
        });
      }
      const resource=createAudioResource(Readable.from([audio]),{inputType:StreamType.WebmOpus});
      const player=session.player;
      return new Promise((resolve,reject)=>{
        let timer,started=false,finished=false;
        const done=(error)=>{
          if(finished)return;
          finished=true;
          clearTimeout(timer);
          player.off(AudioPlayerStatus.Playing,onPlaying);
          player.off(AudioPlayerStatus.Idle,onIdle);
          player.off('error',onError);
          if(error)reject(error);else resolve(true);
        };
        const onPlaying=()=>{started=true};
        const onIdle=()=>{
          if(!started)return done(new Error('Player terminou sem iniciar o áudio'));
          const duration=resource.playbackDuration;
          if(duration<200)return done(new Error(
            'O player iniciou, mas não processou áudio suficiente: '+duration+
            'ms. Verifique WebM/Opus e dependências da FadeHost.'));
          session.lastPlaybackMs=duration;
          console.log('[Duckzinha] Voz: '+duration+
            'ms de áudio processados na call '+session.channelId+'.');
          done();
        };
        const onError=(err)=>done(err);
        player.once(AudioPlayerStatus.Playing,onPlaying);
        player.once(AudioPlayerStatus.Idle,onIdle);
        player.once('error',onError);
        timer=setTimeout(()=>{
          done(new Error('Reprodução TTS excedeu 40 segundos (status: '+
            player.state?.status+', conexão: '+session.connection?.state?.status+')'));
          player.stop(true);
        },40000);
        timer.unref?.();
        try{player.play(resource);}
        catch(err){done(err);}
      });
    });
    session.speechQueue=next.catch(()=>{});
    try{return await next;}finally{session.pendingSpeech--;}
  }
  onBotVoiceState(guildId,channelId){
    const session=this.sessions.get(guildId);
    // Uma remoção ou mudança manual de call invalida a sessão.
    if(session&&channelId!==session.channelId)this.stop(guildId);
  }
  shutdown(){for(const id of [...this.sessions.keys()])this.stop(id)}
}

// Texto preparado para ser lido pelo próprio áudio da Duckzinha.
export function voiceReadableText(answer){
  const clean=String(answer||'')
    .replace(/\*\*|__|~~|`/g,'')
    .replace(/<@!?\d+>|<@&\d+>/g,'')
    .replace(/https?:\/\/\S+/gi,'link no chat')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'')
    .replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
  return clean.slice(0,420)||'Pode me explicar melhor?';
}
