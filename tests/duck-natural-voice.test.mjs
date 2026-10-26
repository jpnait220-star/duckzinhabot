import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_VOICE,PT_BR_VOICES,edgeVoiceOptions,voiceLabel,callVoiceStyle}
 from '../src/duck-tts.mjs';
import {expressiveSpeech} from '../src/duck-smart.mjs';
import {expressiveVoice} from '../src/duck-extras.mjs';
import {googleVoicePreset} from '../src/google-voice-style.mjs';

test('Modo Conversa Natural é selecionável e mantém tom suave sem voz infantil',()=>{
 assert.equal(DEFAULT_VOICE,'pt-BR-ThalitaConversaNeural');
 const selection=PT_BR_VOICES.find(v=>v.id===DEFAULT_VOICE);
 assert.ok(selection);
 assert.equal(selection.edgeId,'pt-BR-ThalitaMultilingualNeural');
 assert.match(voiceLabel(DEFAULT_VOICE),/Conversa Natural/);
 assert.equal(edgeVoiceOptions(DEFAULT_VOICE).pitch,'+0Hz');
 assert.equal(edgeVoiceOptions(DEFAULT_VOICE).rate,'-2%');
 assert.equal(googleVoicePreset(DEFAULT_VOICE).pitch,1);
 assert.equal(googleVoicePreset(DEFAULT_VOICE).speed,0.97);
 assert.equal(expressiveVoice(DEFAULT_VOICE,'animada'),DEFAULT_VOICE);
 assert.equal(expressiveVoice(DEFAULT_VOICE,'curiosa'),DEFAULT_VOICE);
 assert.equal(PT_BR_VOICES.length,25);
});

test('Preparação da fala evita Discord markdown, emojis e links',()=>{
 const txt=expressiveSpeech('**Oi vc!** 🦆💛 KKKKK, olha https://example.com');
 assert.ok(!txt.includes('**'));
 assert.ok(!txt.includes('🦆'));
 assert.ok(!txt.includes('https://'));
 assert.match(txt,/Oi você!/);
 assert.match(txt,/haha/i);
 assert.match(txt,/link que mandei no chat/);
 assert.ok(txt.endsWith('.'));
});

test('Toda fala da call usa estilo curioso suave sem trocar timbre nem mudar texto',async()=>{
 const natural=callVoiceStyle(DEFAULT_VOICE);
 assert.deepEqual(natural,{voice:DEFAULT_VOICE,mood:'curiosa'});
 assert.deepEqual(callVoiceStyle('pt-BR-FranciscaNeural'),
   {voice:'pt-BR-FranciscaNeural',mood:'curiosa'});
 assert.equal(edgeVoiceOptions(natural.voice,natural.mood).pitch,'+3Hz');
 assert.equal(edgeVoiceOptions(natural.voice,natural.mood).rate,'+8%');
 assert.equal(googleVoicePreset(natural.voice,natural.mood).pitch,1.02);
 assert.equal(googleVoicePreset(natural.voice,natural.mood).speed,0.97*1.06);
 // Apenas a síntese de voz da call usa o preset fixo.
 // Os comandos do painel e o texto das respostas continuam independentes.
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/bot.mjs',import.meta.url),'utf8');
 const spoken=/async function speakDuckReply\([^]*?\n}\n\nconst voiceVisits=/.exec(source)?.[0]||'';
 assert.match(spoken,/callVoiceStyle\(selectedVoice\)/);
 assert.doesNotMatch(spoken,/conversationVoiceMood\(/);
 assert.doesNotMatch(spoken,/expressiveVoice\(/);
});
