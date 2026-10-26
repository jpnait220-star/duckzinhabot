import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits,MessageFlags} from 'discord.js';
import {runCommand,commandPayloads} from '../src/commands.mjs';
import {googleVoicePreset,googleVoiceFilter} from '../src/google-voice-style.mjs';
import {expressiveVoice} from '../src/duck-extras.mjs';
import {
  DEFAULT_VOICE,PT_BR_VOICES,SELECTABLE_VOICES,voiceChoices,voiceLabel,validVoice,
  edgeSpeechReady,edgeVoiceOptions,synthesizeDuckSpeech,googleSpeechFallback
} from '../src/duck-tts.mjs';

test('menu oferece apenas timbres Edge distintos e preserva 25 presets legados',()=>{
  assert.equal(PT_BR_VOICES.length,25);
  assert.equal(voiceChoices().length,9);
  assert.equal(SELECTABLE_VOICES.length,9);
  assert.ok(voiceChoices().every(x=>x.value.startsWith('pt-BR-')));
  assert.equal(DEFAULT_VOICE,'pt-BR-ThalitaConversaNeural');
  assert.equal(voiceLabel(DEFAULT_VOICE),'Thalita • Conversa Natural');
  assert.equal(validVoice('pt-BR-ThalitaMultilingualNeural'),true);
  assert.equal(validVoice('pt-BR-LeticiaNeural'),false);
  const choices=commandPayloads().find(x=>x.name==='duckzinha')
    .options.find(x=>x.name==='voice').options[0].choices;
  assert.equal(choices.length,9);
  assert.ok(choices.some(x=>x.value==='pt-BR-FranciscaNeural'));
  assert.ok(choices.some(x=>x.value==='pt-BR-AntonioNeural'));
  assert.ok(choices.some(x=>x.name.includes('Portugal')));
  assert.ok(!choices.some(x=>x.name.includes('Fofinha')));
  const edgeIds=choices.map(x=>PT_BR_VOICES.find(v=>v.id===x.value).edgeId);
  assert.equal(new Set(edgeIds).size,edgeIds.length);
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


const NEW_ANIMATED=[
  ['pt-BR-FranciscaBemAnimadaNeural','pt-BR-FranciscaNeural'],
  ['pt-BR-FranciscaSuperAnimadaNeural','pt-BR-FranciscaNeural'],
  ['pt-BR-FranciscaFofaAnimadaNeural','pt-BR-FranciscaNeural'],
  ['pt-BR-ThalitaAnimadaNeural','pt-BR-ThalitaMultilingualNeural'],
  ['pt-BR-ThalitaSuperAnimadaNeural','pt-BR-ThalitaMultilingualNeural'],
  ['pt-BR-RaquelAnimadaNeural','pt-PT-RaquelNeural'],
  ['pt-BR-RaquelSuperAnimadaNeural','pt-PT-RaquelNeural'],
  ['pt-BR-AntonioAnimadoNeural','pt-BR-AntonioNeural'],
  ['pt-BR-DuarteAnimadoNeural','pt-PT-DuarteNeural']
];

test('Novos estilos animados são únicos, selecionáveis e têm ajustes diferentes',()=>{
  const choiceValues=voiceChoices().map(x=>x.value);
  assert.equal(choiceValues.length,new Set(choiceValues).size);
  assert.ok(choiceValues.length<=25,'Discord aceita no máximo 25 opções estáticas');
  for(const [id,edgeId] of NEW_ANIMATED){
    assert.equal(validVoice(id),true,id);
    const found=PT_BR_VOICES.find(x=>x.id===id);
    assert.equal(found.edgeId,edgeId,id);
    assert.match(found.name,/Animad/);
    assert.ok(googleVoicePreset(id).speed>1.08,id);
    assert.ok(googleVoicePreset(id).pitch>0,id);
    assert.match(edgeVoiceOptions(id).rate,/^\+[0-9]+%$/);
  }
  assert.ok(googleVoicePreset('pt-BR-FranciscaSuperAnimadaNeural').speed>
    googleVoicePreset('pt-BR-FranciscaBemAnimadaNeural').speed);
  assert.ok(googleVoicePreset('pt-BR-ThalitaSuperAnimadaNeural').speed>
    googleVoicePreset('pt-BR-ThalitaAnimadaNeural').speed);
  assert.notEqual(
    googleVoiceFilter('pt-BR-RaquelSuperAnimadaNeural'),
    googleVoiceFilter('pt-BR-RaquelAnimadaNeural')
  );
});

test('Expressão automática adapta também variantes escolhidas no menu',()=>{
  assert.equal(expressiveVoice('pt-BR-ThalitaMultilingualNeural','animada'),
    'pt-BR-ThalitaAnimadaNeural');
  assert.equal(expressiveVoice('pt-BR-RaquelPortugalNeural','animada'),
    'pt-BR-RaquelAnimadaNeural');
  assert.equal(expressiveVoice('pt-BR-AntonioNeural','animada'),
    'pt-BR-AntonioAnimadoNeural');
  assert.equal(expressiveVoice('pt-BR-DuartePortugalNeural','animada'),
    'pt-BR-DuarteAnimadoNeural');
  assert.equal(expressiveVoice('pt-BR-FranciscaSuperAnimadaNeural','calma'),
    'pt-BR-FranciscaSuaveNeural');
  assert.equal(expressiveVoice('pt-BR-ThalitaSuperAnimadaNeural','calma'),
    'pt-BR-ThalitaSuaveNeural');
  assert.equal(expressiveVoice('pt-BR-RaquelSuperAnimadaNeural','curiosa'),
    'pt-BR-RaquelFofaNeural');
  assert.equal(expressiveVoice('pt-BR-FranciscaNeural','animada',false),
    'pt-BR-FranciscaNeural');
});

test('Os novos estilos usam Edge real e Google localizados com o preset escolhido',async()=>{
  const fakeAudio=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
  let call;
  const audio=await synthesizeDuckSpeech({
    text:'Que legal!',voice:'pt-BR-FranciscaSuperAnimadaNeural',
    ttsFactory:()=>({generate:async(text,voice,options)=>{
      call={text,voice,options};
      return {audio:fakeAudio};
    }})
  });
  assert.equal(audio.duckTtsProvider,'edge');
  assert.equal(call.voice,'pt-BR-FranciscaNeural');
  assert.equal(call.options.rate,'+28%');
  let language='',appliedId='';
  const styled=await synthesizeDuckSpeech({
    text:'Vamos!',voice:'pt-BR-RaquelAnimadaNeural',
    ttsFactory:()=>({generate:async()=>{throw Error('Edge indisponível')}}),
    fallbackFetch:async url=>{
      language=new URL(url).searchParams.get('tl');
      return {ok:true,status:200,arrayBuffer:async()=>Buffer.concat([Buffer.from('ID3'),Buffer.alloc(200)])};
    },
    fallbackStyler:async(mp3,id)=>{
      appliedId=id;
      return Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
    }
  });
  assert.equal(language,'pt-PT');
  assert.equal(appliedId,'pt-BR-RaquelAnimadaNeural');
  assert.equal(styled.duckTtsProvider,'google-styled');
});
