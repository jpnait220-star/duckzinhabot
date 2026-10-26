import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_VOICE,voiceLabel} from '../src/duck-tts.mjs';

test('bot speaks through Edge TTS without trying external Kyoko/Piper engines',async()=>{
 const source=await readFile(new URL('../src/bot.mjs',import.meta.url),'utf8');
 assert.equal(source.includes("from './duck-open-tts.mjs'"),false);
 assert.equal(source.includes('tryOpenTtsSpeech('),false);
 assert.ok(source.match(/const audio=await synthesizeDuckSpeech\(/g)?.length>=2);
 assert.equal(DEFAULT_VOICE,'pt-BR-ThalitaMultilingualNeural');
 assert.equal(voiceLabel(DEFAULT_VOICE),'Thalita • Natural');
});
