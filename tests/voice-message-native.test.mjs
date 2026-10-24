import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFlags} from 'discord.js';
import {makeWaveform,nativeVoicePayload,convertToVoiceMessage} from '../src/duck-voice-message.mjs';

test('mensagem nativa tem flag Discord correta e não inclui texto',()=>{
  const audio=Buffer.concat([Buffer.from('OggS'),Buffer.alloc(500)]);
  const payload=nativeVoicePayload({audio,duration:1.25,waveform:Buffer.from([10,20,30]).toString('base64')});
  assert.equal(payload.body.flags,8192);
  assert.equal(payload.body.flags,MessageFlags.IsVoiceMessage);
  assert.equal(payload.body.content,undefined);
  assert.equal(payload.body.attachments.length,1);
  assert.equal(payload.body.attachments[0].filename,'duckzinha-voz.ogg');
  assert.equal(payload.body.attachments[0].duration_secs,1.25);
  assert.equal(payload.files[0].contentType,'audio/ogg');
});
test('uma forma de onda representa a intensidade e tem até 256 pontos',()=>{
  const pcm=Buffer.alloc(16000);
  for(let i=0;i<8000;i++)pcm.writeInt16LE(i<4000?0:Math.round(Math.sin(i/20)*22000),i*2);
  const wave=Buffer.from(makeWaveform(pcm),'base64');
  assert.ok(wave.length>=10&&wave.length<=256);
  assert.ok(wave.at(-1)>wave[0]);
});
test('FFmpeg converte WAV de entrada para Ogg/Opus nativo do Discord',async()=>{
  const rate=8000,samples=rate/2;
  const wav=Buffer.alloc(44+samples*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);
  wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);
  wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)
    wav.writeInt16LE(Math.round(Math.sin(i/rate*440*Math.PI*2)*9000),44+i*2);
  const result=await convertToVoiceMessage(wav,{timeoutMs:15000});
  assert.equal(result.audio.subarray(0,4).toString('ascii'),'OggS');
  assert.ok(result.duration>.4&&result.duration<.7);
  assert.ok(Buffer.from(result.waveform,'base64').length>=3);
  assert.equal(nativeVoicePayload(result).body.flags,8192);
});
