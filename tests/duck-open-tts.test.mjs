import test from 'node:test';
import assert from 'node:assert/strict';
import {tryOpenTtsSpeech,recognizedTtsAudio} from '../src/duck-open-tts.mjs';

const ogg=Buffer.concat([Buffer.from('OggS'),Buffer.alloc(96)]);
const wav=Buffer.alloc(144);wav.write('RIFF',0);wav.write('WAVE',8);
const response=(bytes,status=200)=>({ok:status===200,status,headers:{get:()=>null},arrayBuffer:async()=>bytes});

test('no configured open TTS retains Edge fallback',async()=>{
  const speech=await tryOpenTtsSpeech('olá',{env:{},fetchImpl:()=>{throw Error('should not fetch')}});
  assert.equal(speech,null);
});
test('Kokoro accepts opus Ogg with optional private bearer',async()=>{
  let called=false;
  const result=await tryOpenTtsSpeech('oi',{env:{
    KOKORO_TTS_URL:'https://tts.example/v1/audio/speech',
    KOKORO_TTS_TOKEN:'secret',KOKORO_TTS_VOICE:'pf_dora'},
    fetchImpl:async(url,init)=>{called=true;
      assert.equal(url,'https://tts.example/v1/audio/speech');
      assert.equal(init.headers.Authorization,'Bearer secret');
      assert.equal(JSON.parse(init.body).voice,'pf_dora');
      return response(ogg);
    }});
  assert.equal(called,true);
  assert.equal(recognizedTtsAudio(result),'ogg');
  assert.equal(result.duckTtsProvider,'kokoro');
});
test('Kokoro failure falls back to Piper wav',async()=>{
  const result=await tryOpenTtsSpeech('oi',{env:{
    KOKORO_TTS_URL:'https://bad.example/v1/audio/speech',
    PIPER_TTS_URL:'https://piper.example/v1/audio/speech'},
    fetchImpl:async url=>response(url.includes('bad.')?Buffer.alloc(0):wav,url.includes('bad.')?503:200),
    now:()=>0});
  assert.equal(result.duckTtsProvider,'piper');
});
