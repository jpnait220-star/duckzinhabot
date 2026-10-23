import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits,MessageFlags} from 'discord.js';
import {runCommand,commandPayloads} from '../src/commands.mjs';
import {googleVoicePreset,googleVoiceFilter} from '../src/google-voice-style.mjs';
import {
  DEFAULT_VOICE,PT_BR_VOICES,voiceChoices,voiceLabel,validVoice,
  edgeSpeechReady,edgeVoiceOptions,synthesizeDuckSpeech,googleSpeechFallback
} from '../src/duck-tts.mjs';

test('Onze escolhas (cinco vozes base) aparecem no /duckzinha voice nome',()=>{
  assert.equal(PT_BR_VOICES.length,11);
  assert.equal(voiceChoices().length,11);
  assert.ok(voiceChoices().every(x=>x.value.startsWith('pt-BR-')));
  assert.equal(voiceLabel(DEFAULT_VOICE),'Francisca • Natural');
  assert.equal(validVoice('pt-BR-ThalitaMultilingualNeural'),true);
  assert.equal(validVoice('pt-BR-LeticiaNeural'),false);
  const choices=commandPayloads().find(x=>x.name==='duckzinha')
    .options.find(x=>x.name==='voice').options[0].choices;
  assert.equal(choices.length,11);
  assert.ok(choices.some(x=>x.value==='pt-BR-FranciscaNeural'));
  assert.ok(choices.some(x=>x.value==='pt-BR-AntonioNeural'));
  assert.ok(choices.some(x=>x.name.includes('Portugal')));
  assert.ok(choices.some(x=>x.name.includes('Fofinha')));
  assert.ok(choices.every(x=>/^pt-BR-[A-Za-z]+Neural$/.test(x.value)));
});

test('Somente admin pode trocar a voz, e ela é salva antes de atualizar o cache',async()=>{
  let saved,changed,reply;
  const mk=(admin,choice='pt-BR-ThalitaMultilingualNeural')=>({
    guildId:'g',inGuild:()=>true,commandName:'duckzinha',user:{id:'a'},
    memberPermissions:{has:bit=>admin&&bit===PermissionFlagsBits.Administrator},
    options:{getSubcommand:()=> 'voice',getString:()=>choice},
    reply:async x=>{reply=x}
  });
  const store={guildId:'g',persistent:true,setVoice:async v=>{saved=v}};
  await runCommand(mk(false),{store,onVoiceChanged:v=>{changed=v},edgeVoiceReady:true});
  assert.equal(saved,undefined);
  assert.equal(reply.flags,MessageFlags.Ephemeral);
  await runCommand(mk(true),{store,onVoiceChanged:v=>{changed=v},edgeVoiceReady:true});
  assert.equal(saved,'pt-BR-ThalitaMultilingualNeural');
  assert.equal(changed,saved);
  assert.match(reply.content,/Thalita/);
  assert.match(reply.content,/Edge TTS/);
  assert.equal(reply.flags,MessageFlags.Ephemeral);
  await runCommand(mk(true,'pt-BR-LeticiaNeural'),{store});
  assert.match(reply.content,/português brasileiro/);
  assert.equal(saved,'pt-BR-ThalitaMultilingualNeural');
});

test('Edge TTS gera WebM/Opus e aplica tom levemente agudo nas femininas',async()=>{
  assert.equal(edgeSpeechReady(),true);
  assert.equal(edgeVoiceOptions('pt-BR-FranciscaNeural').pitch,'+12Hz');
  assert.equal(edgeVoiceOptions('pt-BR-FranciscaFofaNeural').pitch,'+35Hz');
  assert.equal(edgeVoiceOptions('pt-BR-AntonioNeural').pitch,'+0Hz');
  assert.throws(()=>edgeVoiceOptions('pt-BR-LeticiaNeural'));
  let called;
  const fakeAudio=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
  const result=await synthesizeDuckSpeech({
    text:'Olá, gente!',voice:'pt-BR-FranciscaNeural',
    ttsFactory:()=>({
      generate:async (text,voice,options)=>{
        called={text,voice,options};return {audio:fakeAudio,format:'webm'};
      }
    })
  });
  assert.deepEqual(result,fakeAudio);
  assert.equal(called.voice,'pt-BR-FranciscaNeural');
  assert.equal(called.options.outputFormat,'webm-24khz-16bit-mono-opus');
  assert.equal(called.options.pitch,'+12Hz');
  const alternative=await synthesizeDuckSpeech({
    text:'Olá!',voice:'pt-BR-RaquelPortugalNeural',
    ttsFactory:()=>({generate:async (text,voice,options)=>{
      called={text,voice,options};return {audio:fakeAudio,format:'webm'};
    }})
  });
  assert.deepEqual(alternative,fakeAudio);
  assert.equal(called.voice,'pt-PT-RaquelNeural');
});

test('Erros do Edge TTS são propagados sem fingir áudio',async()=>{
  await assert.rejects(synthesizeDuckSpeech({text:'oi',voice:'pt-BR-LeticiaNeural'}),/indisponível/);
  await assert.rejects(synthesizeDuckSpeech({text:'   '}),/vazio/);
  await assert.rejects(synthesizeDuckSpeech({
    text:'oi',ttsFactory:()=>({generate:async()=>{throw Error('rede indisponível');}})
  }),/rede indisponível/);
  await assert.rejects(synthesizeDuckSpeech({
    text:'oi',ttsFactory:()=>({generate:async()=>({audio:Buffer.from('mp3')})})
  }),/WebM\/Opus válido/);
});

test('Teste de voz mostra feedback privado e restringe a administradores',async()=>{
  let played=0,feedback='';
  const makeInteraction=admin=>({
    inGuild:()=>true,guildId:'g',commandName:'duckzinha',user:{id:'person'},
    memberPermissions:{has:permission=>admin&&permission===PermissionFlagsBits.Administrator},
    options:{getSubcommand:()=> 'testevoz'},
    reply:async data=>{feedback=data.content;return data;},
    deferReply:async data=>{assert.equal(data.flags,MessageFlags.Ephemeral);},
    editReply:async message=>{feedback=message;return message;}
  });
  const store={guildId:'g',persistent:true};
  await runCommand(makeInteraction(false),{
    store,onVoiceTest:async()=>{played++;return 'Falou!';}
  });
  assert.equal(played,0);
  assert.match(feedback,/administradores/);
  await runCommand(makeInteraction(true),{
    store,onVoiceTest:async()=>{played++;return 'Reprodução concluída';}
  });
  assert.equal(played,1);
  assert.match(feedback,/Reprodução concluída/);
  await runCommand(makeInteraction(true),{
    store,onVoiceTest:async()=>{throw Error('Falha de áudio simulada');}
  });
  assert.match(feedback,/Falha de áudio simulada/);
});

test('Se Edge WebSocket responder HTTP 200, usa áudio MP3 por HTTPS',async()=>{
  const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(256)]);
  const queried=[];
  const audio=await synthesizeDuckSpeech({
    text:'Oi, eu sou a Duckzinha!',
    voice:'pt-BR-FranciscaNeural',
    ttsFactory:()=>({generate:async()=>{throw Error('Unexpected server response: 200')}}),
    fallbackFetch:async url=>{
      queried.push(new URL(url));
      return {ok:true,status:200,arrayBuffer:async()=>mp3};
    }
  });
  assert.deepEqual(audio,mp3);
  assert.equal(queried.length,1);
  assert.equal(queried[0].hostname,'translate.google.com');
  assert.equal(queried[0].searchParams.get('tl'),'pt-BR');
  assert.equal(queried[0].searchParams.get('q'),'Oi, eu sou a Duckzinha!');
});

test('Falha HTTP do TTS alternativo não é tratada como áudio',async()=>{
  await assert.rejects(
    googleSpeechFallback('Olá!',DEFAULT_VOICE,async()=>({
      ok:true,status:200,arrayBuffer:async()=>Buffer.from('<html>no audio</html>')
    })),
    /sem áudio MP3/
  );
  await assert.rejects(
    synthesizeDuckSpeech({
      text:'Olá',
      ttsFactory:()=>({generate:async()=>{throw Error('Unexpected server response: 200')}}),
      fallbackFetch:async()=>({ok:false,status:429})
    }),
    /Edge TTS:.*Google TTS HTTP 429/
  );
});

test('Google TTS alternativo muda tom e velocidade conforme estilo escolhido',()=>{
  const natural=googleVoicePreset('pt-BR-FranciscaNeural');
  const cute=googleVoicePreset('pt-BR-FranciscaFofaNeural');
  const calm=googleVoicePreset('pt-BR-FranciscaSuaveNeural');
  const male=googleVoicePreset('pt-BR-AntonioNeural');
  assert.ok(cute.pitch>natural.pitch);
  assert.ok(cute.speed>natural.speed);
  assert.ok(calm.speed<natural.speed);
  assert.ok(male.pitch<natural.pitch);
  assert.match(googleVoiceFilter('pt-BR-FranciscaFofaNeural'),/asetrate=/);
  assert.match(googleVoiceFilter('pt-BR-FranciscaFofaNeural'),/atempo=/);
  assert.notEqual(
    googleVoiceFilter('pt-BR-FranciscaNeural'),
    googleVoiceFilter('pt-BR-ThalitaMultilingualNeural')
  );
  assert.throws(()=>googleVoiceFilter('inexistente'),/desconhecido/);
});

test('A voz alternativa selecionada passa pelo filtro local e vira WebM/Opus',async()=>{
  const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(256)]);
  const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
  let calledVoice,calledSource;
  const result=await synthesizeDuckSpeech({
    text:'Oi, pessoal!',
    voice:'pt-BR-FranciscaFofaNeural',
    ttsFactory:()=>({generate:async()=>{throw Error('Unexpected server response: 200')}}),
    fallbackFetch:async()=>({ok:true,status:200,arrayBuffer:async()=>mp3}),
    fallbackStyler:async(input,voice)=>{
      calledSource=input;
      calledVoice=voice;
      return webm;
    }
  });
  assert.equal(calledVoice,'pt-BR-FranciscaFofaNeural');
  assert.deepEqual(calledSource,mp3);
  assert.equal(result,webm);
  assert.equal(result.duckTtsProvider,'google-styled');
});
