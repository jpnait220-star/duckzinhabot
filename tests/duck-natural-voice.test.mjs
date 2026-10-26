import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_VOICE,PT_BR_VOICES,edgeVoiceOptions,voiceLabel}
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
