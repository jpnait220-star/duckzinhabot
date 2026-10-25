import test from 'node:test';
import assert from 'node:assert/strict';
import {commandPayloads} from '../src/commands.mjs';
import {edgeVoiceOptions,synthesizeDuckSpeech} from '../src/duck-tts.mjs';
import {expressiveVoice} from '../src/duck-extras.mjs';
import {googleVoiceFilter,googleVoicePreset} from '../src/google-voice-style.mjs';
import {conversationVoiceMood,playfulCallReply} from '../src/duck-smart.mjs';

test('interpreta tom da pergunta, mesmo com resposta neutra da IA',()=>{
  assert.equal(conversationVoiceMood('GG EU GANHEI O PVP!!!','Que legal!'),'animada');
  assert.equal(conversationVoiceMood('Estou triste porque perdi meus itens','Vamos conversar'),'calma');
  assert.equal(conversationVoiceMood('Você sabia disso?','É interessante'),'curiosa');
  assert.equal(conversationVoiceMood('Estou com muito sono','Tchau'),'sonolenta');
  assert.equal(conversationVoiceMood('Conta uma piada kkk','Que bom'),'animada');
});

test('piadas são respostas originais, curtas e com variação sem IA externa',()=>{
  const input='conta uma piada sobre Minecraft';
  const jokes=new Set(Array.from({length:4},(_,index)=>playfulCallReply(input,index)));
  assert.equal(jokes.size,4);
  for(const joke of jokes)assert.match(joke,/pat[o|o]|minecraft|creeper/i);
  assert.match(playfulCallReply('dá uma risada pra mim',0),/Hehehe/);
  assert.equal(playfulCallReply('qual é o horário?',0),null);
});

test('ritmo e tom diferem realmente entre animada, normal e calma',()=>{
  const base='pt-BR-FranciscaNeural';
  const excited=edgeVoiceOptions(base,'animada');
  const natural=edgeVoiceOptions(base,'auto');
  const calm=edgeVoiceOptions(base,'calma');
  assert.notEqual(excited.rate,natural.rate);
  assert.notEqual(calm.rate,natural.rate);
  assert.ok(Number.parseInt(excited.rate,10)>Number.parseInt(natural.rate,10));
  assert.ok(Number.parseInt(calm.rate,10)<Number.parseInt(natural.rate,10));
  assert.ok(googleVoicePreset(base,'animada').speed>googleVoicePreset(base,'auto').speed);
  assert.ok(googleVoicePreset(base,'calma').speed<googleVoicePreset(base,'auto').speed);
  assert.notEqual(googleVoiceFilter(base,'animada'),googleVoiceFilter(base,'calma'));
  const voice=expressiveVoice('pt-BR-FranciscaFofaNeural','animada');
  assert.equal(voice,'pt-BR-FranciscaAnimadaNeural');
});

test('sintetizador entrega emoção ao Edge e filtro Google',async()=>{
  const fakeWebm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
  let edgeOptions,filterOptions;
  const edge=await synthesizeDuckSpeech({
    text:'GG! Eu ganhei!',mood:'animada',
    ttsFactory:()=>({generate:async (_text,_id,opts)=>{
      edgeOptions=opts;return {audio:fakeWebm};
    }})
  });
  assert.equal(edge.duckTtsProvider,'edge');
  assert.equal(edgeOptions.rate,'+20%');
  const mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(256)]);
  await synthesizeDuckSpeech({
    text:'Tudo bem. Vamos com calma.',mood:'calma',
    ttsFactory:()=>({generate:async ()=>{throw Error('Edge bloqueado');}}),
    fallbackFetch:async ()=>({ok:true,status:200,arrayBuffer:async()=>mp3}),
    fallbackStyler:async (_audio,_voice,opts)=>{
      filterOptions=opts;return fakeWebm;
    }
  });
  assert.equal(filterOptions.tone,'calma');
});

test('comando testevoz permite diagnosticar estilo e escolher piada',()=>{
  const cmd=commandPayloads().find(x=>x.name==='duckzinha');
  const check=cmd.options.find(x=>x.name==='testevoz');
  const choice=check.options.find(x=>x.name==='estilo').choices.map(x=>x.value);
  assert.deepEqual(choice,['normal','animada','calma','curiosa','sonolenta','piada']);
});
