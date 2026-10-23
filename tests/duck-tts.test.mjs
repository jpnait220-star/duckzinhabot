import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits,MessageFlags} from 'discord.js';
import {runCommand,commandPayloads} from '../src/commands.mjs';
import {
  DEFAULT_VOICE,PT_BR_VOICES,voiceChoices,voiceLabel,validVoice,
  azureSpeechReady,voiceSSML,synthesizeDuckSpeech
} from '../src/duck-tts.mjs';

test('Dezoito vozes brasileiras aparecem no /duckzinha voice nome',()=>{
  assert.equal(PT_BR_VOICES.length,18);
  assert.equal(voiceChoices().length,18);
  assert.ok(voiceChoices().every(x=>x.value.startsWith('pt-BR-')));
  assert.equal(voiceLabel(DEFAULT_VOICE),'Letícia');
  assert.equal(validVoice('pt-BR-YaraNeural'),true);
  assert.equal(validVoice('en-US-JennyNeural'),false);
  const choices=commandPayloads().find(x=>x.name==='duckzinha')
    .options.find(x=>x.name==='voice').options[0].choices;
  assert.equal(choices.length,18);
  assert.ok(choices.some(x=>x.value==='pt-BR-GiovannaNeural'));
});

test('Somente admin pode trocar a voz, e ela é salva antes de atualizar o cache',async()=>{
  let saved,changed,reply;
  const mk=(admin,choice='pt-BR-GiovannaNeural')=>({
    guildId:'g',inGuild:()=>true,commandName:'duckzinha',user:{id:'a'},
    memberPermissions:{has:bit=>admin&&bit===PermissionFlagsBits.Administrator},
    options:{getSubcommand:()=> 'voice',getString:()=>choice},
    reply:async x=>{reply=x}
  });
  const store={guildId:'g',persistent:true,setVoice:async v=>{saved=v}};
  await runCommand(mk(false),{store,onVoiceChanged:v=>{changed=v},azureVoiceReady:true});
  assert.equal(saved,undefined);
  assert.equal(reply.flags,MessageFlags.Ephemeral);
  await runCommand(mk(true),{store,onVoiceChanged:v=>{changed=v},azureVoiceReady:true});
  assert.equal(saved,'pt-BR-GiovannaNeural');
  assert.equal(changed,saved);
  assert.match(reply.content,/Giovanna/);
  assert.equal(reply.flags,MessageFlags.Ephemeral);
  await runCommand(mk(true,'en-US-JennyNeural'),{store});
  assert.match(reply.content,/português brasileiro/);
});

test('Azure monta SSML protegido contra texto XML e usa formato Ogg/Opus',async()=>{
  assert.equal(azureSpeechReady({key:'chave',region:'brazilsouth'}),true);
  assert.equal(azureSpeechReady({key:'',region:'brazilsouth'}),false);
  assert.equal(azureSpeechReady({key:'chave',region:'../../example'}),false);
  assert.match(voiceSSML('olá & <teste>','pt-BR-YaraNeural'),/olá &amp; &lt;teste&gt;/);
  assert.throws(()=>voiceSSML('ola','en-US-JennyNeural'));
  let got;
  const audio=Buffer.concat([Buffer.from('OggS'),Buffer.alloc(64)]);
  const fetcher=async (url,options)=>{
    got={url,options};
    return {ok:true,headers:{get:()=>String(audio.length)},arrayBuffer:async()=>audio};
  };
  const out=await synthesizeDuckSpeech({
    text:'Olá, gente!',voice:'pt-BR-LeticiaNeural',key:'chave',region:'brazilsouth',fetcher
  });
  assert.equal(out.toString('ascii',0,4),'OggS');
  assert.equal(got.options.headers['X-Microsoft-OutputFormat'],'ogg-24khz-16bit-mono-opus');
  assert.equal(got.options.headers['Ocp-Apim-Subscription-Key'],'chave');
  assert.match(got.options.body,/LeticiaNeural/);
});

test('Audio inválido ou indisponibilidade falha sem fingir reprodução',async()=>{
  await assert.rejects(synthesizeDuckSpeech({text:'oi',key:'',region:''}));
  await assert.rejects(synthesizeDuckSpeech({
    text:'oi',key:'chave',region:'brazilsouth',
    fetcher:async()=>({ok:false,status:401})
  }),/401/);
  await assert.rejects(synthesizeDuckSpeech({
    text:'oi',key:'chave',region:'brazilsouth',
    fetcher:async()=>({ok:true,headers:{get:()=>0},arrayBuffer:async()=>Buffer.from('bad')})
  }),/inválido/);
});
