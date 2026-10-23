import test from 'node:test';
import assert from 'node:assert/strict';
import {ChannelType,PermissionFlagsBits} from 'discord.js';
import {VoiceConnectionStatus} from '@discordjs/voice';
import {DuckVoiceVisits,voiceMentionContext,voiceReadableText,VOICE_IDLE_MS} from '../src/voice-visit.mjs';

function fixture({sameCall=true,connect=true,publicChannel=true}={}){
  const role={id:'everyone'};
  const voice={
    id:'channelA',guildId:'guildA',type:ChannelType.GuildVoice,name:'geral',
    permissionsFor:target=>({
      has:()=>target===role?publicChannel:connect
    })
  };
  const guild={roles:{everyone:role},voiceAdapterCreator:()=>{},members:{me:{id:'botId'}}};
  const message={
    guildId:'guildA',guild,channel:voice,channelId:voice.id,
    inGuild:()=>true,
    member:{voice:{channelId:sameCall?voice.id:'anotherChannel'}}
  };
  return {message,voice,guild};
}

test('Uma menção válida ocorre no chat público da mesma call',()=>{
  const {message}=fixture();
  assert.equal(voiceMentionContext(message),message.channel);
  assert.equal(voiceMentionContext(fixture({sameCall:false}).message),null);
  assert.equal(voiceMentionContext(fixture({publicChannel:false}).message),null);
});

test('Entra preparada para falar, renova prazo com menções, sai após cinco minutos',async()=>{
  let now=1_000_000,serial=0,joinCount=0,destroyed=0;
  const tasks=new Map();
  const clock={
    now:()=>now,
    setTimer:(fn,delay)=>{const id=++serial;tasks.set(id,{fn,at:now+delay});return id;},
    clearTimer:id=>tasks.delete(id)
  };
  const join=config=>{
    joinCount++;
    assert.equal(config.channelId,'channelA');
    assert.equal(config.selfMute,false);
    assert.equal(config.selfDeaf,true);
    return {state:{status:VoiceConnectionStatus.Ready},destroy:()=>{destroyed++}};
  };
  const manager=new DuckVoiceVisits({
    ...clock,join,waitReady:async()=>{},timeoutMs:VOICE_IDLE_MS
  });
  const {message}=fixture();
  assert.deepEqual(await manager.mention(message),{ok:true,joined:true,channelId:'channelA'});
  assert.equal(joinCount,1);
  now+=4*60_000;
  assert.equal((await manager.mention(message)).joined,false);
  assert.equal(joinCount,1);
  // Mesmo se o primeiro timeout estiver pendente, o prazo atualizado prevalece.
  now+=VOICE_IDLE_MS-1;
  for(const [id,task] of [...tasks])if(task.at<=now){tasks.delete(id);task.fn();}
  assert.equal(destroyed,0);
  now+=1;
  for(const [id,task] of [...tasks])if(task.at<=now){tasks.delete(id);task.fn();}
  assert.equal(destroyed,1);
  assert.equal(manager.sessions.size,0);
});

test('Não entra quando o canal proíbe conectar',async()=>{
  const session=new DuckVoiceVisits({join:()=>{throw Error('Não deveria tentar');}});
  const r=await session.mention(fixture({connect:false}).message);
  assert.equal(r.reason,'missing-permissions');
});

test('Formata a resposta da IA para TTS, sem Markdown nem mencionar cargos',()=>{
  const cleaned=voiceReadableText('**Oii!** 🦆💛\nVeja https://example.com <@123456789123456789>');
  assert.ok(cleaned.startsWith('Oii!'));
  assert.ok(!cleaned.includes('**'));
  assert.ok(!cleaned.includes('https://'));
  assert.ok(!cleaned.includes('<@'));
  assert.ok(cleaned.length<=420);
});
