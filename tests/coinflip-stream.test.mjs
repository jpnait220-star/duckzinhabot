import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {writeFfmpegFrame} from '../src/duck-ffmpeg-stream.mjs';

function fakeStream(writeResult=false){
  const stream=new EventEmitter();
  stream.destroyed=false;
  stream.writableEnded=false;
  stream.write=()=>writeResult;
  return stream;
}

test('18 frames com backpressure não acumulam listeners de erro no Socket',async()=>{
  const stream=fakeStream(false);
  for(let n=0;n<18;n++){
    const pending=writeFfmpegFrame(stream,Buffer.from('frame'));
    assert.equal(stream.listenerCount('error'),1);
    assert.equal(stream.listenerCount('drain'),1);
    stream.emit('drain');
    await pending;
    assert.equal(stream.listenerCount('error'),0);
    assert.equal(stream.listenerCount('drain'),0);
    assert.equal(stream.listenerCount('close'),0);
  }
});

test('escrita imediata não deixa listeners pendurados',async()=>{
  const stream=fakeStream(true);
  await writeFfmpegFrame(stream,Buffer.from('frame'));
  assert.equal(stream.listenerCount('error'),0);
});

test('erro e fechamento do pipe limpam todos os listeners temporários',async()=>{
  for(const event of ['error','close']){
    const stream=fakeStream();
    const pending=writeFfmpegFrame(stream,Buffer.from('frame'));
    const failure=assert.rejects(pending,event==='error'?/falha simulada/:/fechou o pipe/);
    if(event==='error')stream.emit('error',new Error('falha simulada'));
    else stream.emit('close');
    await failure;
    assert.equal(stream.listenerCount('error'),0);
    assert.equal(stream.listenerCount('drain'),0);
    assert.equal(stream.listenerCount('close'),0);
  }
});
